import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import { getIDByName } from 'enmity/api/assets';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const colors = {
    online:  "#23a55a",
    idle:    "#f0b232",
    dnd:     "#f23f43",
    offline: "#80848e",
};

// Discord'un kendi binary içindeki ikon ID'leri
const clientIcons: Record<string, number | null> = {
    desktop:  getIDByName("ic_monitor_24px")  || getIDByName("ic_desktop")   || getIDByName("img_monitor"),
    mobile:   getIDByName("ic_phone_24px")    || getIDByName("ic_mobile_device") || getIDByName("ic_mobile"),
    web:      getIDByName("ic_globe_24px")    || getIDByName("ic_globe")     || getIDByName("img_globe"),
    embedded: getIDByName("ic_controller_24px") || getIDByName("ic_console") || getIDByName("ic_gamepad"),
    vr:       getIDByName("ic_vr_24px")       || getIDByName("ic_vr")        || getIDByName("img_vr"),
};

const PlatformIndicators: Plugin = {
    ...manifest,

    onStart() {
        const SessionStore = getByProps("getSessions", "getSession");
        const UserStore    = getByProps("getUser", "getCurrentUser");
        const { View, Image } = getByProps("View", "Image") || {};
        const TouchableOpacity = getByProps("TouchableOpacity")?.TouchableOpacity;

        if (!SessionStore || !UserStore || !View) return;

        // Aktif oturumlardan { client, status } listesi oluştur
        const getActiveSessions = () => {
            try {
                const sessions = SessionStore.getSessions() || {};
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

        // Aktif oturumlar için Image element listesi döndür
        const buildIcons = (sessions: { client: string; status: string }[]) => {
            if (!Image || sessions.length === 0) return null;

            return sessions.map(({ client, status }, i) => {
                const iconId = clientIcons[client];
                if (!iconId) return null;

                return React.createElement(Image, {
                    key: `pi_${client}_${i}`,
                    source: iconId,
                    style: {
                        width:      16,
                        height:     16,
                        marginLeft: 4,
                        tintColor:  (colors as any)[status] ?? colors.online,
                    }
                });
            }).filter(Boolean);
        };

        // ── Username render etmede çalışan yer: UserStore.getUser ──────────────
        // Sadece kendi ID'miz için aktif oturumu ikonlarıyla döndür
        Patcher.after(UserStore, "getUser", (_self, _args, res) => {
            try {
                const current = UserStore.getCurrentUser?.();
                if (!res || !current || res.id !== current.id) return res;
                const sessions = getActiveSessions();
                if (!sessions.length || !Image) return res;

                // Username'e string eklemek yerine custom render fonksiyonu koy
                // Enmity'de bu obje dondurulmuş olsa bile yeni bir klon döndürebiliriz
                const icons = sessions.map(({ client }) => {
                    const m: Record<string, string> = {
                        desktop:  " \u{1F5A5}",
                        mobile:   " \u{1F4F1}",
                        web:      " \u{1F310}",
                        embedded: " \u{1F3AE}",
                        vr:       " \u{1F97D}",
                    };
                    return m[client] ?? "";
                }).join("");

                if (icons && !res.username?.includes(icons.trim())) {
                    return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                        username:   (res.username  ?? "") + icons,
                        globalName: res.globalName ? res.globalName + icons : res.globalName,
                    });
                }
            } catch { /* sessizce devam et */ }
            return res;
        });

        Patcher.after(UserStore, "getCurrentUser", (_self, _args, res) => {
            try {
                if (!res) return res;
                const sessions = getActiveSessions();
                if (!sessions.length) return res;

                const icons = sessions.map(({ client }) => {
                    const m: Record<string, string> = {
                        desktop:  " \u{1F5A5}",
                        mobile:   " \u{1F4F1}",
                        web:      " \u{1F310}",
                        embedded: " \u{1F3AE}",
                        vr:       " \u{1F97D}",
                    };
                    return m[client] ?? "";
                }).join("");

                if (icons && !res.username?.includes(icons.trim())) {
                    return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                        username:   (res.username  ?? "") + icons,
                        globalName: res.globalName ? res.globalName + icons : res.globalName,
                    });
                }
            } catch { /* sessizce devam et */ }
            return res;
        });

        // ── Üye listesi / mesaj satırı için TouchableOpacity yaması ─────────
        // phone-plugin trae'ın kullandığı taktik: TouchableOpacity'nin render'ını yakala
        if (TouchableOpacity && Image) {
            Patcher.after(TouchableOpacity, "render", (_self, args, res) => {
                try {
                    const current = UserStore.getCurrentUser?.();
                    if (!current) return res;

                    // user prop'u olan ve benim ID'me sahip olan her yerden ikonları ekle
                    const user = res?.props?.user || args[0]?.user;
                    if (!user || user.id !== current.id) return res;

                    const sessions = getActiveSessions();
                    const iconElements = buildIcons(sessions);
                    if (!iconElements || !iconElements.length) return res;

                    // Mevcut children'a ikonları ekle
                    if (res?.props?.children && Array.isArray(res.props.children)) {
                        res.props.children.push(
                            React.createElement(View, {
                                key: "pi_icon_row",
                                style: { flexDirection: "row", alignItems: "center" }
                            }, ...iconElements)
                        );
                    }
                } catch { /* sessizce devam et */ }
                return res;
            });
        }

    },

    onStop() {
        Patcher.unpatchAll();
    }
};

registerPlugin(PlatformIndicators);
