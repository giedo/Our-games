# Our-games

Home-made games. Each game lives in its own folder and runs in the browser, with no installation.

| Game | What it is | Play |
| --- | --- | --- |
| [Krabbel Kart](krabbel-kart/) | A kart racer where the kids' own drawings become the 3D racers: nine worlds, race, battle and explore modes, items and obstacles. iPad and PC, 1 or 2 players. | open `krabbel-kart/index.html` through a web server (see below) |

## Putting it online (GitHub Pages)

The repo is a plain static site, so GitHub Pages can serve it as it is:

1. On GitHub, open **Settings > Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
3. After a minute the games shelf is at `https://<your-user>.github.io/my-games/` and the game at `.../my-games/krabbel-kart/`.

On an iPad, open that address in Safari and use **Share > Add to Home Screen** to get a full-screen app icon.

## Running it on your own computer

```bash
cd my-games
python3 -m http.server 8080
# then open http://localhost:8080
```

A web server is needed because browsers refuse to load JavaScript modules straight from a double-clicked file. If you prefer a single file that does work by double-clicking, see "One-file version" in the [Krabbel Kart README](krabbel-kart/README.md).
