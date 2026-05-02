import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

// Platform adları — emoji yok, temiz metin
const clientNames: Record<string, string> = {
    desktop:  "Desktop",
    mobile:   "Phone",
    web:      "Web",
    embedded: "Console",
    vr:       "VR",
};

const PlatformIndicators: Plugin = {
    ...manifest,

    onStart() {
        const SessionStore = getByProps("getSessions", "getSession");
        const UserStore    = getByProps("getUser", "getCurrentUser");

        if (!UserStore) return;

        // Aktif platformları "Phone · Desktop" formatında döndür
        const buildPlatformText = (): string => {
            if (!SessionStore) return "";
            try {
                const sessions = SessionStore.getSessions?.() ?? {};
                const seen = new Set<string>();
                const names: string[] = [];
                for (const s of Object.values(sessions) as any[]) {
                    const client: string = s?.clientInfo?.client;
                    if (client && clientNames[client] && !seen.has(client)) {
                        seen.add(client);
                        names.push(clientNames[client]);
                    }
                }
                return names.length > 0 ? " [" + names.join(" · ") + "]" : "";
            } catch { return ""; }
        };

        // getCurrentUser — profil sayfasına her girilişte tetiklenir (KANIT: 2.3.0'da çalıştı)
        Patcher.after(UserStore, "getCurrentUser", (_s: any, _a: any, res: any) => {
            try {
                if (!res?.username) return res;
                const text = buildPlatformText();
                if (!text) return res;

                // Daha önce eklendiyse tekrar ekleme
                if (res.username.includes("[") && res.username.includes("]")) return res;

                return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                    username:   res.username + text,
                    globalName: res.globalName
                        ? res.globalName + text
                        : res.globalName,
                });
            } catch {}
            return res;
        });

        // getUser — başkaları bize baktığında da görsün
        Patcher.after(UserStore, "getUser", (_s: any, args: any[], res: any) => {
            try {
                if (!res?.username) return res;
                const current = UserStore.getCurrentUser?.();
                if (!current || res.id !== current.id) return res;

                const text = buildPlatformText();
                if (!text) return res;
                if (res.username.includes("[") && res.username.includes("]")) return res;

                return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                    username:   res.username + text,
                    globalName: res.globalName
                        ? res.globalName + text
                        : res.globalName,
                });
            } catch {}
            return res;
        });
    },

    onStop() {
        Patcher.unpatchAll();
    }
};

registerPlugin(PlatformIndicators);
