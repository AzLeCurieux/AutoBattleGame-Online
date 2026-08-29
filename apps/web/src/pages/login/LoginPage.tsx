import { MIN_PASSWORD_LENGTH, PIN_RE, USERNAME_RE, type ProfileListEntry } from '@autobattle/shared';
import { Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api, ApiError } from '../../common/api';
import { avatarUrl } from '../../common/avatar';

type View = 'profiles' | 'login' | 'create';

/** views/login.html — "Qui joue aujourd'hui ?" */
export function LoginPage() {
  const [view, setView] = useState<View>('profiles');
  const [users, setUsers] = useState<ProfileListEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProfileListEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [pin, setPin] = useState(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'pin' | 'password'>('pin');
  const [createPin, setCreatePin] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.profiles().then(setUsers, () => setUsers([]));
  }, []);

  const showView = (next: View) => {
    setError(null);
    setPin(['', '', '', '']);
    setPassword('');
    setCreateName('');
    setCreatePin('');
    setCreatePassword('');
    setCreateType('pin');
    setSearch('');
    setView(next);
  };

  const selectProfile = (user: ProfileListEntry) => {
    setSelected(user);
    showView('login');
    setTimeout(() => (user.hasPin ? pinRefs.current[0] : passwordRef.current)?.focus(), 100);
  };

  const fail = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleLogin = async (pinDigits = pin) => {
    if (!selected || loading) return;
    let secret: string;
    if (selected.hasPin) {
      secret = pinDigits.join('');
      if (secret.length < 4) return setError('Code PIN incomplet');
    } else {
      secret = password;
      if (!secret) return setError('Mot de passe requis');
    }
    setLoading(true);
    try {
      await api.login(selected.username, secret);
      window.location.href = '/';
    } catch (err) {
      fail(err instanceof ApiError && err.code === 'LOCKED' ? err.message : err instanceof ApiError && err.status === 401 ? 'Code incorrect' : 'Erreur de connexion');
      if (selected.hasPin) {
        setPin(['', '', '', '']);
        pinRefs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const username = createName.trim();
    if (!username || username.length < 3) return setError('Le nom doit faire au moins 3 caractères');
    if (!USERNAME_RE.test(username)) return setError('Lettres, chiffres et _ uniquement');
    const isPin = createType === 'pin';
    const secret = isPin ? createPin : createPassword;
    if (isPin && !PIN_RE.test(secret)) return setError('Le PIN doit contenir exactement 4 chiffres');
    if (!isPin && secret.length < MIN_PASSWORD_LENGTH) {
      return setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`);
    }
    setLoading(true);
    try {
      await api.register(username, secret, isPin);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de joindre le serveur');
    } finally {
      setLoading(false);
    }
  };

  const onPinInput = (index: number, value: string) => {
    const digit = value.slice(-1);
    const next = pin.map((d, i) => (i === index ? digit : d));
    setPin(next);
    if (digit.length === 1) {
      if (index < 3) pinRefs.current[index + 1]?.focus();
      else void handleLogin(next);
    }
  };

  const onPinKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) pinRefs.current[index - 1]?.focus();
  };

  const onEnter = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') fn();
  };

  const term = search.toLowerCase();
  const visible = users.filter((u) => u.username.toLowerCase().includes(term));

  return (
    <>
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>

      <div className="container">
        <div id="view-profiles" className={`view-section ${view === 'profiles' ? 'active' : ''}`}>
          <h1>Qui joue aujourd&apos;hui ?</h1>
          <p className="subtitle">Sélectionnez votre profil pour continuer</p>

          <div className="search-wrapper">
            <input
              type="text"
              id="search-input"
              className="search-input"
              placeholder="Rechercher un profil..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="search-icon" size={18} />
          </div>

          <div id="profiles-grid" className="profiles-grid">
            {visible.map((user) => (
              <div key={user.username} className="profile-card" onClick={() => selectProfile(user)}>
                <div className="avatar" style={{ backgroundImage: `url('${avatarUrl(user.avatar, user.username)}')` }}></div>
                <span className="profile-name">{user.username}</span>
              </div>
            ))}
            <div className="profile-card" id="btn-create-profile" onClick={() => showView('create')}>
              <div className="avatar">
                <Plus className="add-btn-content" size={56} strokeWidth={1.5} />
              </div>
              <span className="profile-name">Ajouter</span>
            </div>
          </div>
        </div>

        <div id="view-login" className={`view-section ${view === 'login' ? 'active' : ''}`}>
          <div className={`glass-panel ${shake ? 'shake' : ''}`}>
            <div className="user-preview">
              <div
                id="login-avatar"
                className="avatar"
                style={selected ? { backgroundImage: `url('${avatarUrl(selected.avatar, selected.username)}')` } : undefined}
              ></div>
              <h2 id="login-username" style={{ marginBottom: 5 }}>
                {selected?.username ?? 'Username'}
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Bon retour !</span>
            </div>

            <div id="login-error" className="error-message" style={{ display: error && view === 'login' ? 'block' : 'none' }}>
              {error}
            </div>

            <div id="login-pin-area" className={selected?.hasPin ? '' : 'hidden'}>
              <p style={{ marginBottom: 10, color: 'var(--text-muted)' }}>Entrez votre code PIN</p>
              <div className="pin-container">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      pinRefs.current[i] = el;
                    }}
                    type="password"
                    className="pin-digit"
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="off"
                    value={digit}
                    onChange={(e) => onPinInput(i, e.target.value)}
                    onKeyDown={(e) => onPinKeyDown(i, e)}
                  />
                ))}
              </div>
            </div>

            <div id="login-pass-area" className={`form-group ${selected && !selected.hasPin ? '' : 'hidden'}`}>
              <label className="form-label">Mot de passe</label>
              <input
                ref={passwordRef}
                type="password"
                id="login-password"
                className="form-input"
                placeholder="Votre mot de passe"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onEnter(() => void handleLogin())}
              />
            </div>

            <button id="btn-login-submit" className="btn btn-primary" onClick={() => void handleLogin()}>
              Se connecter
            </button>
            <button id="btn-login-cancel" className="btn btn-secondary" onClick={() => showView('profiles')}>
              Changer de profil
            </button>
          </div>
        </div>

        <div id="view-create" className={`view-section ${view === 'create' ? 'active' : ''}`}>
          <div className="glass-panel">
            <h2 style={{ marginBottom: 30 }}>Créer un profil</h2>

            <div id="create-error" className="error-message" style={{ display: error && view === 'create' ? 'block' : 'none' }}>
              {error}
            </div>

            <div className="form-group">
              <label className="form-label">Nom du profil</label>
              <input
                type="text"
                id="create-username"
                className="form-input"
                placeholder="Ex: GigaChad123"
                maxLength={20}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Type de sécurité</label>
              <div className="auth-options">
                <div className={`auth-option ${createType === 'pin' ? 'selected' : ''}`} onClick={() => setCreateType('pin')}>
                  Code PIN
                </div>
                <div
                  className={`auth-option ${createType === 'password' ? 'selected' : ''}`}
                  onClick={() => setCreateType('password')}
                >
                  Mot de passe
                </div>
              </div>
            </div>

            <div id="create-pin-area" className={createType === 'pin' ? '' : 'hidden'}>
              <label className="form-label">Code PIN (4 chiffres)</label>
              <input
                type="text"
                id="create-pin"
                className="form-input"
                placeholder="Ex: 1234"
                maxLength={4}
                inputMode="numeric"
                value={createPin}
                onChange={(e) => setCreatePin(e.target.value)}
                onKeyDown={onEnter(() => void handleCreate())}
              />
            </div>

            <div id="create-pass-area" className={createType === 'password' ? '' : 'hidden'}>
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                id="create-password"
                className="form-input"
                placeholder={`Minimum ${MIN_PASSWORD_LENGTH} caractères`}
                autoComplete="new-password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                onKeyDown={onEnter(() => void handleCreate())}
              />
            </div>

            <button id="btn-create-submit" className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => void handleCreate()}>
              Créer le profil
            </button>
            <button id="btn-create-cancel" className="btn btn-secondary" onClick={() => showView('profiles')}>
              Annuler
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}
    </>
  );
}
