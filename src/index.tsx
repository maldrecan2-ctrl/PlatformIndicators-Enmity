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
        // SADECE username alanını değiştiriyoruz.
        // Discord sohbette globalName'i gösterir → chat etkilenmez.
        // username sadece profilin ALT kısmında görünür → istediğimiz bu!
        Patcher.after(UserStore, "getCurrentUser", (_s: any, _a: any, res: any) => {
            try {
                if (!res?.username) return res;
                const text = buildPlatformText();
                if (!text) return res;

                // Daha önce eklendiyse tekrar ekleme
                if (res.username.includes(" · ") || res.username.includes("Desktop") || res.username.includes("Phone")) return res;

                return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                    username: res.username + " [" + text + "]",
                    // globalName'e DOKUNMUYORUZ → sohbette çıkmaz
                });
            } catch {}
            return res;
        });

        // ── getUser ───────────────────────────────────────────────────────────
        Patcher.after(UserStore, "getUser", (_s: any, args: any[], res: any) => {
            try {
                if (!res?.username) return res;
                const current = UserStore.getCurrentUser?.();
                if (!current || res.id !== current.id) return res;

                const text = buildPlatformText();
                if (!text) return res;
                if (res.username.includes(" · ") || res.username.includes("Desktop") || res.username.includes("Phone")) return res;

                return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                    username: res.username + " [" + text + "]",
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
