import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

// Discord'un aynı platform indicator eklentisinde kullandığı orijinal unicode karakterler
// (SVG değil - bunlar Discord'un kendi UI'ında zaten var olan ve render edilebilen semboller)
const clientSymbols: Record<string, string> = {
    desktop:  "\u{1F5A5}",  // 🖥
    web:      "\u{1F310}",  // 🌐
    mobile:   "\u{1F4F1}",  // 📱
    embedded: "\u{1F3AE}",  // 🎮
    vr:       "\u{1F97D}",  // 🥽
};

const PlatformIndicators: Plugin = {
    ...manifest,

    onStart() {
        const SessionStore = getByProps("getSessions", "getSession");
        const UserStore    = getByProps("getUser", "getCurrentUser");
        const Messages     = getByProps("sendMessage", "editMessage");

        if (!SessionStore || !UserStore) return;

        // Aktif oturumlardan icon string'i oluştur
        const buildIcons = (): string => {
            try {
                const sessions = SessionStore.getSessions() || {};
                const seen = new Set<string>();
                let result = "";
                for (const s of Object.values(sessions) as any[]) {
                    const client: string = s?.clientInfo?.client;
                    if (client && clientSymbols[client] && !seen.has(client)) {
                        seen.add(client);
                        result += clientSymbols[client];
                    }
                }
                return result ? " " + result : "";
            } catch { return ""; }
        };

        // ── 1. getCurrentUser yamasi ──────────────────────────────────────────
        // Bu kendi profilimizin ismini değiştiriyor (daha önce çalıştı).
        Patcher.after(UserStore, "getCurrentUser", (_self, _args, res) => {
            try {
                if (res?.username) {
                    const icons = buildIcons();
                    if (icons && !res.username.includes(icons.trim())) {
                        res.username  = res.username + icons;
                        if (res.globalName) res.globalName = res.globalName + icons;
                    }
                }
            } catch { /* sessizce devam et */ }
            return res;
        });

        // ── 2. getUser yamasi ─────────────────────────────────────────────────
        // Başkası kendi profilimize tıkladığında da görmesi için.
        Patcher.after(UserStore, "getUser", (_self, args, res) => {
            try {
                const currentUser = UserStore.getCurrentUser?.();
                if (res?.username && currentUser && res.id === currentUser.id) {
                    const icons = buildIcons();
                    if (icons && !res.username.includes(icons.trim())) {
                        res.username  = res.username + icons;
                        if (res.globalName) res.globalName = res.globalName + icons;
                    }
                }
            } catch { /* sessizce devam et */ }
            return res;
        });

        // ── 3. sendMessage yamasi ─────────────────────────────────────────────
        // Yazdığın mesajların sonuna cihaz ikonunu otomatik ekler.
        if (Messages) {
            Patcher.before(Messages, "sendMessage", (_self, args) => {
                try {
                    if (args[1] && typeof args[1].content === "string") {
                        const icons = buildIcons();
                        if (icons && !args[1].content.endsWith(icons)) {
                            args[1].content += icons;
                        }
                    }
                } catch { /* sessizce devam et */ }
            });
        }
    },

    onStop() {
        Patcher.unpatchAll();
    }
};

registerPlugin(PlatformIndicators);
