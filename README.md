# GD Leads Dashboard (client view)

Password-protected copy of the GD leads dashboard, served with GitHub Pages.

- `index.html`, `shim.js`, `charts.js`, `app.js`, `d3.min.js` — the page and its login screen.
- `data.enc.json` — the dashboard data, encrypted. Rebuilt every 4 hours by a scheduled Claude task.
- `keys.json` — the decryption key, itself locked with the client's username and password (not stored anywhere).
- `public.pem` — used by the refresh to encrypt new data; it cannot decrypt anything.
- `encrypt_data.py`, `make_keys.py` — the tools for the above. To change the login, run make_keys.py, then encrypt_data.py.
