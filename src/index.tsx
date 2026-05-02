import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

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
                return names.join(" · ");  // örn: "Phone · Desktop"
            } catch { return ""; }
        };

        // ── getCurrentUser ────────────────────────────────────────────────────
        // SADECE pronouns alanını değiştiriyoruz.
        // Discord pronoms alanını YALNIZCA profil sayfasında gösterir — sohbette ASLA çıkmaz.
        // username ve globalName'e dokunmuyoruz → chat etkilenmez.
        Patcher.after(UserStore, "getCurrentUser", (_s: any, _a: any, res: any) => {
            try {
                if (!res) return res;
                const text = buildPlatformText();
                if (!text) return res;

                return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                    pronouns: text,  // "Phone · Desktop" gibi temiz metin
                });
            } catch {}
            return res;
        });

        // ── getUser ───────────────────────────────────────────────────────────
        // Başkası profilimizdeki pronoms'u gördüğünde de aynı şeyi döndür
        Patcher.after(UserStore, "getUser", (_s: any, args: any[], res: any) => {
            try {
                if (!res) return res;
                const current = UserStore.getCurrentUser?.();
                if (!current || res.id !== current.id) return res;

                const text = buildPlatformText();
                if (!text) return res;

                return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                    pronouns: text,
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
