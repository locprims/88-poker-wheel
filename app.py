import os, sqlite3, secrets, hashlib, hmac, json
from datetime import datetime, timezone
from urllib.parse import parse_qsl
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="/static")
DB_PATH = os.environ.get("DB_PATH", "data/wheel.db")
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "")

PRIZES = [(10,50),(20,25),(30,13),(40,7),(50,4),(88,1)]

def db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con=db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS players(
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      spins_available INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spins(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      prize INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    """)
    con.commit(); con.close()

def now():
    return datetime.now(timezone.utc).isoformat()

def verify_init_data(init_data):
    if not BOT_TOKEN or not init_data:
        return None
    pairs=dict(parse_qsl(init_data, keep_blank_values=True))
    their_hash=pairs.pop("hash", None)
    if not their_hash: return None
    data_check="\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret=hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    ours=hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(ours, their_hash): return None
    try:
        user=json.loads(pairs.get("user","{}"))
        return user if user.get("id") else None
    except Exception:
        return None

def current_user():
    # DEV mode lets you test locally without Telegram. Disable in production.
    if os.environ.get("DEV_MODE") == "1":
        return {"id": int(request.headers.get("X-Debug-User","880001")),
                "username":"testplayer","first_name":"Test"}
    return verify_init_data(request.headers.get("X-Telegram-Init-Data",""))

def ensure_player(user):
    con=db()
    con.execute("""INSERT INTO players(telegram_id,username,first_name,spins_available,updated_at)
                   VALUES(?,?,?,?,?)
                   ON CONFLICT(telegram_id) DO UPDATE SET
                   username=excluded.username, first_name=excluded.first_name,
                   updated_at=excluded.updated_at""",
                (user["id"],user.get("username",""),user.get("first_name",""),1,now()))
    con.commit()
    row=con.execute("SELECT * FROM players WHERE telegram_id=?",(user["id"],)).fetchone()
    con.close()
    return dict(row)

def pick_prize():
    n=secrets.randbelow(100)+1
    acc=0
    for prize,weight in PRIZES:
        acc+=weight
        if n<=acc: return prize
    return 10

@app.get("/")
def home():
    return send_from_directory("static","index.html")

@app.get("/api/me")
def me():
    user=current_user()
    if not user: return jsonify(error="telegram_auth_required"),401
    return jsonify(ensure_player(user))

@app.post("/api/spin")
def spin():
    user=current_user()
    if not user: return jsonify(error="telegram_auth_required"),401
    ensure_player(user)
    con=db()
    try:
        con.execute("BEGIN IMMEDIATE")
        row=con.execute("SELECT spins_available FROM players WHERE telegram_id=?",(user["id"],)).fetchone()
        if not row or row["spins_available"]<1:
            con.rollback()
            return jsonify(error="no_spin_available"),403
        prize=pick_prize()
        con.execute("UPDATE players SET spins_available=spins_available-1, updated_at=? WHERE telegram_id=?",
                    (now(),user["id"]))
        cur=con.execute("INSERT INTO spins(telegram_id,prize,created_at,status) VALUES(?,?,?,'pending')",
                        (user["id"],prize,now()))
        con.commit()
        return jsonify(prize=prize, spin_id=cur.lastrowid, spins_available=row["spins_available"]-1)
    finally:
        con.close()

def admin_ok():
    supplied=request.headers.get("X-Admin-Key","")
    return bool(ADMIN_KEY) and hmac.compare_digest(supplied, ADMIN_KEY)

@app.post("/api/admin/grant")
def grant():
    if not admin_ok(): return jsonify(error="unauthorized"),401
    body=request.get_json(force=True)
    tid=int(body["telegram_id"])
    con=db()
    # Grant exactly one available spin, rather than stacking unlimited spins.
    con.execute("""INSERT INTO players(telegram_id,username,first_name,spins_available,updated_at)
                   VALUES(?,?,?,?,?)
                   ON CONFLICT(telegram_id) DO UPDATE SET spins_available=1,updated_at=excluded.updated_at""",
                (tid,body.get("username",""),body.get("first_name",""),1,now()))
    con.commit(); con.close()
    return jsonify(ok=True, telegram_id=tid, spins_available=1)

@app.get("/api/admin/players")
def admin_players():
    if not admin_ok(): return jsonify(error="unauthorized"),401
    con=db()
    rows=con.execute("""SELECT p.telegram_id,p.username,p.first_name,p.spins_available,p.updated_at,
        COUNT(s.id) total_spins, COALESCE(SUM(s.prize),0) total_won
        FROM players p LEFT JOIN spins s ON s.telegram_id=p.telegram_id
        GROUP BY p.telegram_id ORDER BY p.updated_at DESC LIMIT 500""").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])

@app.post("/api/admin/revoke")
def revoke():
    if not admin_ok(): return jsonify(error="unauthorized"),401
    tid=int(request.get_json(force=True)["telegram_id"])
    con=db(); con.execute("UPDATE players SET spins_available=0,updated_at=? WHERE telegram_id=?",(now(),tid))
    con.commit(); con.close()
    return jsonify(ok=True)

@app.get("/api/admin/spins")
def admin_spins():
    if not admin_ok(): return jsonify(error="unauthorized"),401
    con=db()
    rows=con.execute("""SELECT s.id,s.telegram_id,p.username,p.first_name,s.prize,s.created_at,s.status
                        FROM spins s LEFT JOIN players p ON p.telegram_id=s.telegram_id
                        ORDER BY s.id DESC LIMIT 200""").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])

@app.post("/api/admin/spins/<int:spin_id>/paid")
def mark_paid(spin_id):
    if not admin_ok(): return jsonify(error="unauthorized"),401
    con=db(); con.execute("UPDATE spins SET status='paid' WHERE id=?",(spin_id,)); con.commit(); con.close()
    return jsonify(ok=True)

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT","8000")))
