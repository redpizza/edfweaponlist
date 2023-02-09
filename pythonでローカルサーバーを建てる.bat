cd /d %~dp0
cd ..
start http://localhost:8000/edfweaponlist/4-1/
python -m http.server 8000

