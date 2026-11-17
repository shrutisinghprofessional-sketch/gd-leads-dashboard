"""Encrypt the dashboard's data files for the client site.

  python3 -I encrypt_data.py --data-dir OUT_DIR --pub SITE_DIR/public.pem --dest SITE_DIR/data.enc.json

OUT_DIR holds by_source.json, by_caller.json, changes.json, backlog.json, refollow.json, quality.json, info.json
(written by gd_refresh.py). Only their rows are kept. Uses the public key, so this step can't decrypt anything.
"""
import argparse, base64, gzip, json, os
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

NAMES = ['by_source', 'by_caller', 'changes', 'backlog', 'refollow', 'quality', 'info']

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data-dir', required=True); ap.add_argument('--pub', required=True); ap.add_argument('--dest', required=True)
    a = ap.parse_args()
    data = {}
    for n in NAMES:
        with open(os.path.join(a.data_dir, n + '.json'), encoding='utf-8') as fh:
            data[n] = json.load(fh)['rows']
    if not data['info'] or not data['by_source']:
        raise SystemExit('EMPTY DATA: refusing to publish')
    plain = gzip.compress(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), 9)
    pub = serialization.load_pem_public_key(open(a.pub, 'rb').read())
    key, iv = AESGCM.generate_key(256), os.urandom(12)
    ct = AESGCM(key).encrypt(iv, plain, None)
    ek = pub.encrypt(key, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    b = lambda x: base64.b64encode(x).decode()
    info = data['info'][0]
    with open(a.dest, 'w') as fh:
        json.dump({'v': 1, 'refreshed': info.get('refreshed'), 'ek': b(ek), 'iv': b(iv), 'ct': b(ct)}, fh)
    print(f"encrypted {len(plain)} bytes (gzip) -> {a.dest}; refreshed={info.get('refreshed')} {info.get('refreshed_time')}")

if __name__ == '__main__':
    main()
