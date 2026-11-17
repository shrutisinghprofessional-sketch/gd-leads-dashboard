"""Create the login keys for the client dashboard site.

Run once (and again only to change the username/password):
  python3 make_keys.py --user USERNAME --password PASSWORD --out SITE_DIR

Writes SITE_DIR/public.pem (used by the refresh to encrypt data; it cannot decrypt) and
SITE_DIR/keys.json (the private key, locked with the username + password). The password is not stored.
After changing keys, run encrypt_data.py again so data.enc.json matches the new key.
"""
import argparse, base64, json, os
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERATIONS = 600_000

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--user', required=True); ap.add_argument('--password', required=True); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    priv = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    pkcs8 = priv.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    pub = priv.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    salt, iv = os.urandom(16), os.urandom(12)
    secret = (a.user.strip().lower() + '\n' + a.password).encode()
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(secret)
    wrapped = AESGCM(key).encrypt(iv, pkcs8, None)
    os.makedirs(a.out, exist_ok=True)
    open(os.path.join(a.out, 'public.pem'), 'wb').write(pub)
    b = lambda x: base64.b64encode(x).decode()
    json.dump({'v': 1, 'iterations': ITERATIONS, 'salt': b(salt), 'iv': b(iv), 'wrapped': b(wrapped)},
              open(os.path.join(a.out, 'keys.json'), 'w'))
    print('keys written to', a.out)

if __name__ == '__main__':
    main()
