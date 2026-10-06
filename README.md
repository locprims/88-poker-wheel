# 88 Poker Club Telegram Lucky Wheel — V1

Cette V1 implémente la règle **1 validation manuelle = 1 tour**.

## Sécurité / logique
- Le joueur est identifié avec les données signées de Telegram Mini Apps.
- Le serveur refuse le tirage si `spins_available == 0`.
- Une validation admin remet le joueur à exactement 1 tour.
- Le tour est consommé atomiquement au moment du tirage.
- Le résultat est choisi côté serveur avec un générateur cryptographique.
- Probabilités : 10$ 50%, 20$ 25%, 30$ 13%, 40$ 7%, 50$ 4%, 88$ 1%.
- Chaque résultat est enregistré dans SQLite avec statut `pending`.

## Installation
1. Installer Python 3.11+.
2. `pip install -r requirements.txt`
3. Définir les variables d'environnement de `.env.example`.
4. Démarrer avec `gunicorn -w 2 -b 0.0.0.0:8000 app:app`.
5. Publier derrière HTTPS sur votre domaine.
6. Configurer l'URL HTTPS comme Telegram Mini App de votre bot.

## Test local
Définir `DEV_MODE=1`, `ADMIN_KEY` et lancer `python app.py`.
Pour la production remettre impérativement `DEV_MODE=0`.

## Administration
Ouvrir `/static/admin.html`, saisir la clé admin et le Telegram ID du joueur, puis cliquer sur « Autoriser 1 tour ».

## Étape suivante recommandée
Ajouter une vraie connexion admin (au lieu d'une clé saisie dans la page), recherche des joueurs par pseudo, bouton « payé », export CSV, et éventuellement attribution automatique après vérification du nombre de mains.

## Important
Ce projet est une base technique. Avant une campagne avec récompenses monétaires, vérifiez les règles applicables aux promotions/jeux d'argent dans les juridictions concernées.
