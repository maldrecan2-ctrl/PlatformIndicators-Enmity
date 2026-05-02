import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { React } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import { getIDByName } from 'enmity/api/assets';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

// Toast bildirimine göre Discord'un gerçek asset isimleri:
const assetIds = {
    mobile:   getIDByName("StatusMobileOnline"),
    desktop:  getIDByName("ic_monitor"),
    web:      getIDByName("ic_globe_24px") || getIDByName("ic_globe") || getIDByName("ic_web"),
    embedded: getIDByName("ic_controller_24px") || getIDByName("ic_controller") || getIDByName("ic_gamepad_24px"),
    vr:       getIDByName("ic_vr_24px") || getIDByName("ic_vr"),
};

const statusColors: Record<string, string> = {
    online:  "#23a55a",
    idle:    "#f0b232",
    dnd:     "#f23f43",
    offline: "#80848e",
};

const PlatformIndicators: Plugin = {
    ...manifest,

    onStart() {
        const SessionStore = getByProps("getSessions", "getSession");
        const UserStore    = getByProps("getUser", "getCurrentUser");

        // phone-plugin trae taktiği: TouchableOpacity.render yamala
        const TOModule = getByProps("TouchableOpacity");
        const { View, Image } = getByProps("View", "Image") || {};

        if (!SessionStore || !UserStore || !TOModule || !View || !Image) return;

        const TO = TOModule.default || TOModule.TouchableOpacity || TOModule;
        if (!TO || !TO.prototype) return;

        // Aktif oturumları al
        const getActiveSessions = (): { client: string; status: string }[] => {
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

        // Icon elementi oluştur
        const buildIconRow = (sessions: { client: string; status: string }[]) => {
            const icons = sessions.map(({ client, status }, i) => {
                const id = (assetIds as any)[client];
                if (!id) return null;
                return React.createElement(Image, {
                    key: `pi_${client}_${i}`,
                    source: id,
                    style: {
                        width: 14,
                        height: 14,
                        marginLeft: 3,
                        tintColor: statusColors[status] ?? statusColors.online,
                    }
                });
            }).filter(Boolean);

            if (!icons.length) return null;

            return React.createElement(View, {
                key: "pi_icon_row",
                style: { flexDirection: "row", alignItems: "center" }
            }, ...icons);
        };

        // phone-plugin taktiği: prototype.render yamala
        Patcher.after(TO.prototype, "render", function(_self, _args, res) {
            try {
                // Sadece bir user prop'u içeriyorsa ve o user biz isek işlem yap
                const props = res?.props ?? {};
                const user = props?.user
                    ?? props?.member?.user
                    ?? props?.profile?.user
                    ?? null;

                const currentUser = UserStore.getCurrentUser?.();
                if (!user || !currentUser || user.id !== currentUser.id) return res;

                const sessions = getActiveSessions();
                if (!sessions.length) return res;

                const iconRow = buildIconRow(sessions);
                if (!iconRow) return res;

                // Mevcut children'a ikonları ekle
                const children = props.children;
                if (Array.isArray(children)) {
                    // Daha önce ekledik mi kontrol et
                    if (children.some((c: any) => c?.key === "pi_icon_row")) return res;
                    props.children = [...children, iconRow];
                } else if (children) {
                    if (children?.key === "pi_icon_row") return res;
                    props.children = [children, iconRow];
                }
            } catch { /* sessizce devam et */ }
            return res;
        });

    },

    onStop() {
        Patcher.unpatchAll();
    }
};

registerPlugin(PlatformIndicators);
