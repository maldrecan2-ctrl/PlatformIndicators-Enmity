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
        const { View, Image, Text } = getByProps("View", "Image", "Text") || {};

        if (!SessionStore || !UserStore || !View || !Image) return;

        const getActiveSessions = () => {
            try {
                const seen = new Set<string>();
                const result: { client: string; status: string }[] = [];
                for (const s of Object.values(SessionStore.getSessions() || {}) as any[]) {
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
                    key: `pi_${i}`,
                    source: id,
                    style: { width: 14, height: 14, marginLeft: 3, tintColor: statusColors[status] ?? statusColors.online }
                });
            }).filter(Boolean);
            if (!icons.length) return null;
            return React.createElement(View, {
                key: "pi_icons",
                style: { flexDirection: "row", alignItems: "center", marginLeft: 4 }
            }, ...icons);
        };

        // ── 1. UserRow ──────────────────────────────────────────────────────────
        // DM listesindeki kullanıcı satırı
        const UserRowModule = getByTypeName("UserRow", { default: true });
        if (UserRowModule?.default) {
            Patcher.after(UserRowModule, "default", (_s: any, args: any[], res: any) => {
                try {
                    const current = UserStore.getCurrentUser?.();
                    if (!current || !res?.props) return res;

                    // UserRow'da user birden fazla yerde olabilir
                    const props = args[0] ?? {};
                    const userId: string = 
                        props?.user?.id ??
                        props?.userId ??
                        props?.id ??
                        res?.props?.user?.id ??
                        "";

                    if (!userId || userId !== current.id) return res;

                    const sessions = getActiveSessions();
                    const iconRow = buildIconRow(sessions);
                    if (!iconRow) return res;

                    // res'in en dıştaki View'ının children'ına ekle
                    const ch = res.props.children;
                    if (Array.isArray(ch)) {
                        if (ch.some((c: any) => c?.key === "pi_icons")) return res;
                        res.props.children = [...ch, iconRow];
                    } else {
                        res.props.children = [ch, iconRow];
                    }
                } catch(e) {}
                return res;
            });
        }

        // ── 2. getUserTag ───────────────────────────────────────────────────────
        // Kullanıcı tag'i (BOT gibi) döndüren fonksiyon — isme yanına küçük ikon eklemek için ideal
        const getUserTagModule = getByTypeName("getUserTag", { default: true }) ||
                                 getByProps("getUserTag");
        if (getUserTagModule) {
            const fnName = getUserTagModule.getUserTag ? "getUserTag" : "default";
            Patcher.after(getUserTagModule, fnName, (_s: any, args: any[], res: any) => {
                try {
                    const current = UserStore.getCurrentUser?.();
                    if (!current) return res;

                    // getUserTag'e geçilen user id
                    const userId: string = args[0]?.id ?? args[0]?.userId ?? args[0] ?? "";
                    if (!userId || userId !== current.id) return res;

                    const sessions = getActiveSessions();
                    const iconRow = buildIconRow(sessions);
                    if (!iconRow) return res;

                    // Tag elementi yoksa sadece ikonları döndür
                    if (!res) return iconRow;

                    // Tag elementi varsa yanına ekle
                    return React.createElement(View, {
                        style: { flexDirection: "row", alignItems: "center" }
                    }, res, iconRow);
                } catch(e) {}
                return res;
            });
        }

        // ── 3. Teşhis Toast ─────────────────────────────────────────────────────
        setTimeout(() => {
            const current = UserStore.getCurrentUser?.();
            const sessions = getActiveSessions();
            const assetStr = Object.entries(assetIds)
                .map(([k, v]) => `${k}:${v ? "✓" : "✗"}`)
                .join(" ");
            Toasts.open({ 
                content: `PI2.9 | user:${current?.id?.slice(-4)} sess:${sessions.length} | ${assetStr}`
            });
        }, 2000);
    },

    onStop() { Patcher.unpatchAll(); }
};

registerPlugin(PlatformIndicators);
