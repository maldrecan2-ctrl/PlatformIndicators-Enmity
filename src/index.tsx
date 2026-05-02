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
        const UserStore = getByProps("getUser", "getCurrentUser");
        const { View, Image } = getByProps("View", "Image") || {};

        if (!UserStore || !View || !Image) return;

        // SESİON STORE İÇİN FARKLI ARAMA YÖNTEMLERİ DENE
        // Discord'un farklı sürümlerinde farklı isimler kullanılıyor
        const SessionStore = 
            getByProps("getSessions", "getRemoteActivities") ||   // v261
            getByProps("getSessions", "getSessionId") ||           // eski
            getByProps("getSessions") ||                           // minimal
            getByProps("getActiveSession") ||                      // alternatif
            getByProps("getSessionId", "getActiveJDA");            // başka alternatif

        const getActiveSessions = (): { client: string; status: string }[] => {
            if (!SessionStore) return [];
            try {
                // Farklı method isimleri dene
                const sessions =
                    SessionStore.getSessions?.() ??
                    SessionStore.getActiveSessions?.() ??
                    SessionStore.getAllSessions?.() ??
                    {};

                const seen = new Set<string>();
                const result: { client: string; status: string }[] = [];
                for (const s of Object.values(sessions) as any[]) {
                    const client: string = s?.clientInfo?.client;
                    const status: string = s?.status ?? "online";
                    if (client && !seen.has(client)) {
                        seen.add(client);
                        result.push({ client, status });
                    }
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

        // UserRow — DM listesi (bulundu, çalışıyor)
        const UserRowModule = getByTypeName("UserRow", { default: true });
        if (UserRowModule?.default) {
            let toastShown = false;
            Patcher.after(UserRowModule, "default", (_s: any, args: any[], res: any) => {
                try {
                    const current = UserStore.getCurrentUser?.();
                    if (!current || !res?.props) return res;

                    const props = args[0] ?? {};

                    // İlk render'da args yapısını göster
                    if (!toastShown) {
                        toastShown = true;
                        const keys = Object.keys(props).join(",");
                        const sessions = getActiveSessions();
                        Toasts.open({ content: `UserRow keys: ${keys.slice(0, 80)} | sess:${sessions.length}` });
                    }

                    // Daha geniş userId arama — her ihtimali kapsıyor
                    const userId: string =
                        props?.user?.id ??
                        props?.userId ??
                        props?.uid ??
                        props?.id ??
                        (typeof props?.recipientId === "string" ? props.recipientId : "") ??
                        res?.props?.user?.id ??
                        res?.props?.userId ??
                        "";

                    if (!userId || userId !== current.id) return res;

                    const sessions = getActiveSessions();
                    const iconRow = buildIconRow(sessions);
                    if (!iconRow) return res;

                    const ch = res.props.children;
                    if (Array.isArray(ch)) {
                        if (ch.some((c: any) => c?.key === "pi_icons")) return res;
                        res.props.children = [...ch, iconRow];
                    } else if (ch) {
                        res.props.children = [ch, iconRow];
                    }
                } catch(e) {}
                return res;
            });
        }

        // getUserTag — Kullanıcı etiketi (bulundu, çalışıyor)
        const getUserTagModule = getByTypeName("getUserTag", { default: true }) ||
                                 getByProps("getUserTag");
        if (getUserTagModule) {
            const fnName = getUserTagModule.getUserTag ? "getUserTag" : "default";
            let tagToastShown = false;
            Patcher.after(getUserTagModule, fnName, (_s: any, args: any[], res: any) => {
                try {
                    const current = UserStore.getCurrentUser?.();
                    if (!current) return res;

                    if (!tagToastShown) {
                        tagToastShown = true;
                        Toasts.open({ content: `getUserTag args[0]: ${JSON.stringify(args[0]).slice(0, 80)}` });
                    }

                    const userId: string = args[0]?.id ?? args[0]?.userId ?? args[0] ?? "";
                    if (!userId || userId !== current.id) return res;

                    const sessions = getActiveSessions();
                    const iconRow = buildIconRow(sessions);
                    if (!iconRow) return res;

                    if (!res) return iconRow;
                    return React.createElement(View, {
                        style: { flexDirection: "row", alignItems: "center" }
                    }, res, iconRow);
                } catch(e) {}
                return res;
            });
        }
    },

    onStop() { Patcher.unpatchAll(); }
};

registerPlugin(PlatformIndicators);
