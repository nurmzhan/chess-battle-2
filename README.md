# ♛ Chess Roguelite

Я сделал мультиплеерные шахматы с 2D-битвами: когда игрок пытается съесть фигуру, захват решается не автоматически, а через короткий бой между атакующей и защищающейся фигурой. Проект рассчитан на игроков, которым нравятся шахматы, но хочется больше динамики, риска и аркадного взаимодействия. Ценность игры в том, что она превращает обычное взятие фигуры в отдельный напряженный момент, где можно отыграться, защититься и изменить исход партии не только за счет шахматной позиции, но и за счет навыка в бою.

Multiplayer chess where piece captures trigger roguelite 2D battles. The attacker only wins the square if they defeat the defender in combat!

## Features

- ♟ **Full Chess Rules** — castling, check, checkmate, stalemate
- ⚔️ **Battle System** — captures trigger RPG battles between pieces
- 🏰 **Classes** — each piece type has a unique battle class (King=Paladin, Queen=Mage, Rook=Warrior, Bishop=Ranger, Knight=Assassin, Pawn=Rogue)
- 🌐 **Multiplayer** — play with anyone via room codes
- 📊 **Stats** — wins, losses, rating tracked per account
- 🏆 **Leaderboard** — see top players

## Database: Supabase (Recommended)

### Why Supabase?
- Free tier with 500MB storage
- Built-in PostgreSQL
- Works perfectly with Prisma
- No credit card required

### Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
3. Choose a name, password, and region
4. Wait ~2 minutes for it to spin up
5. Go to **Settings > Database**
6. Scroll to **Connection string > URI** and copy it
7. Replace `[YOUR-PASSWORD]` with your DB password

## Installation

```bash
# Clone or copy this project
cd chess-roguelite

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Copy env file
cp .env.example .env.local

# Edit .env.local with your values:
# DATABASE_URL=postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres
# NEXTAUTH_SECRET=<run: openssl rand -base64 32>
# NEXTAUTH_URL=http://localhost:3000

# Push database schema
npx prisma db push

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Adding Your Piece Images

Copy your PNG files to `public/pieces/` with these exact names:
```
public/pieces/
  whitePawn.png
  whiteKnight.png
  whiteBishop.png
  whiteRook.png
  whiteQueen.png
  whiteKing.png
  blackPawn.png
  blackKnight.png
  blackBishop.png
  blackRook.png
  blackQueen.png
  blackKing.png
```

If images don't load, it automatically falls back to Unicode chess symbols.

## Project Structure

```
src/
  app/
    page.tsx              # Home (lobby if logged in, landing if not)
    login/page.tsx        # Login
    register/page.tsx     # Register
    game/[code]/page.tsx  # Game room
    api/
      auth/              # NextAuth + register
      game/              # Create/join/move
      stats/             # Leaderboard
  components/
    chess/
      ChessBoard.tsx     # Board rendering
      ChessPiece.tsx     # Piece with image/unicode fallback
    battle/
      BattleArena.tsx    # Roguelite fight screen
    ui/
      LobbyPage.tsx      # Main lobby
      LandingPage.tsx    # Landing for guests
  lib/
    chess-engine.ts      # Chess logic (moves, check, etc.)
    battle-system.ts     # Battle stats and simulation
    prisma.ts            # DB client
  types/
    index.ts             # All TypeScript types
```

## Battle System Details

| Piece   | Class    | HP  | ATK | DEF | SPD | Special       |
|---------|----------|-----|-----|-----|-----|---------------|
| King    | Paladin  | 140 | 20  | 18  | 6   | Holy Smite    |
| Queen   | Mage     | 70  | 32  | 5   | 10  | Arcane Burst  |
| Rook    | Warrior  | 120 | 18  | 14  | 7   | Shield Bash   |
| Bishop  | Ranger   | 85  | 22  | 8   | 12  | Piercing Shot |
| Knight  | Assassin | 75  | 28  | 7   | 16  | Death Strike  |
| Pawn    | Rogue    | 65  | 15  | 6   | 14  | Backstab      |

- Attacker goes first (they initiated the capture)
- Every 3rd round = special ability (1.5x damage)
- Higher speed = higher crit chance
- If attacker wins → capture succeeds
- If defender wins → piece stays, attacker retreats, turn still switches

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel deploy
```
Set environment variables in Vercel dashboard.

## Future Improvements
- [ ] WebSocket real-time moves (currently polls every 2s)
- [ ] Animated battle sprites
- [ ] En passant
- [ ] Time controls
- [ ] Chat
- [ ] Spectator mode
# chess-battle
