import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps, getByTypeName } from 'enmity/metro';
import { Toasts, React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import { getIDByName } from 'enmity/api/assets';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const assetIds = {
    mobile:   getIDByName("StatusMobileOnline"),
    desktop:  getIDByName("ic_monitor"),
    web:      getIDByName("ic_globe_24px") || getIDByName("ic_globe"),
    embedded: getIDByName("ic_controller_24px") || getIDByName("ic_controller"),
    vr:       getIDByName("ic_vr_24px") || getIDByName("ic_vr"),
};

const statusColors: Record<string, string> = {
    online: "#23a55a", idle: "#f0b232", dnd: "#f23f43", offline: "#80848e",
};

const PlatformIndicators: Plugin = {
    ...manifest,

    onStart() {
        const SessionStore = getByProps("getSessions", "getSession");
        const UserStore    = getByProps("getUser", "getCurrentUser");
        const { View, Image } = getByProps("View", "Image") || {};

        if (!UserStore || !View || !Image) return;

        const getActiveSessions = (): { client: string; status: string }[] => {
            if (!SessionStore) return [];
            try {
                const sessions = SessionStore.getSessions?.() ?? {};
                const seen = new Set<string>();
                const result: { client: string; status: string }[] = [];
                for (const s of Object.values(sessions) as any[]) {
                    const client: string = s?.clientInfo?.client;
                    const status: string = s?.status ?? "online";
                    if (client && !seen.has(client)) { seen.add(client); result.push({ client, status }); }
                }
                return result;
            } catch { return []; }
        };

        const buildIconRow = (sessions: { client: string; status: string }[]) => {
            const icons = sessions.map(({ client, status }, i) => {
                const id = (assetIds as any)[client];
                if (!id) return null;
                return React.createElement(Image, {
                    key: `pi_${i}`, source: id,
                    style: { width: 14, height: 14, marginLeft: 3, tintColor: statusColors[status] ?? statusColors.online }
                });
            }).filter(Boolean);
            if (!icons.length) return null;
            return React.createElement(View, {
                key: "pi_icons",
                style: { flexDirection: "row", alignItems: "center", marginLeft: 4 }
            }, ...icons);
        };

        // ── UserRow — sunucu üye listesinde test et ──────────────────────────
        const UserRowModule = getByTypeName("UserRow", { default: true });
        if (UserRowModule?.default) {
            let toastShown = false;
            Patcher.after(UserRowModule, "default", (_s: any, args: any[], res: any) => {
                try {
                    const current = UserStore.getCurrentUser?.();
                    if (!current || !res?.props) return res;

                    const props = args[0] ?? {};

                    // İlk render'da teşhis Toast'u (sadece bir kez)
                    if (!toastShown) {
                        toastShown = true;
                        const keys = Object.keys(props).slice(0, 8).join(",");
                        const sess = getActiveSessions();
                        Toasts.open({ content: `UserRow! keys:${keys} | sess:${sess.length}` });
                    }

                    // Kullanıcı ID bul
                    const userId: string =
                        props?.user?.id ?? props?.userId ?? props?.uid ??
                        props?.id ?? res?.props?.user?.id ?? "";

                    if (!userId || userId !== current.id) return res;

                    const sessions = getActiveSessions();
                    const iconRow = buildIconRow(sessions);
                    if (!iconRow) return res;

                    const ch = res.props.children;
                    if (Array.isArray(ch)) {
                        if (!ch.some((c: any) => c?.key === "pi_icons"))
                            res.props.children = [...ch, iconRow];
                    } else {
                        res.props.children = [ch, iconRow];
                    }
                } catch {}
                return res;
            });
        }

        // ── getCurrentUser — HER ZAMAN çalışan güvenli yedek ───────────────
        // Bu kesin çalışıyor (2.3.0'da kanıtlandı). Sessions orada yüklü oluyor.
        Patcher.after(UserStore, "getCurrentUser", (_s: any, _a: any, res: any) => {
            try {
                if (!res?.username) return res;
                const sessions = getActiveSessions();
                if (!sessions.length) return res;

                // Asset ID varsa görünmez bir marker ekle (debug)
                const hasAssets = Object.values(assetIds).some(Boolean);

                // Sadece asset ID yoksa text emoji kullan
                const icons = sessions.map(({ client }) => {
                    if (hasAssets && (assetIds as any)[client]) {
                        // Asset varsa sadece marker — zaten UserRow'dan ikonu görüyoruz
                        return "";
                    }
                    // Fallback text
                    const m: Record<string, string> = {
                        desktop: " \u{1F5A5}", mobile: " \u{1F4F1}",
                        web: " \u{1F310}", embedded: " \u{1F3AE}", vr: " \u{1F97D}",
                    };
                    return m[client] ?? "";
                }).join("");

                if (icons && !res.username.includes(icons.trim())) {
                    return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                        username:   res.username + icons,
                        globalName: res.globalName ? res.globalName + icons : res.globalName,
                    });
                }
            } catch {}
            return res;
        });
    },

    onStop() { Patcher.unpatchAll(); }
};

registerPlugin(PlatformIndicators);
