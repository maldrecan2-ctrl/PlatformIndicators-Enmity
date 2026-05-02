import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps, getByTypeName, getModule } from 'enmity/metro';
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
                    key: `pi_${i}`, source: id,
                    style: { width: 14, height: 14, marginLeft: 3, tintColor: statusColors[status] ?? statusColors.online }
                });
            }).filter(Boolean);
            if (!icons.length) return null;
            return React.createElement(View, { style: { flexDirection: "row", alignItems: "center" } }, ...icons);
        };

        const patchAfter = (mod: any, fnName: string) => {
            if (!mod || !mod[fnName]) return false;
            try {
                Patcher.after(mod, fnName, (_s: any, args: any[], res: any) => {
                    try {
                        const user = args[0]?.user || args[0]?.message?.author || args[0]?.member?.user;
                        const current = UserStore.getCurrentUser?.();
                        if (!user || !current || user.id !== current.id) return res;
                        const sessions = getActiveSessions();
                        const iconRow = buildIconRow(sessions);
                        if (!iconRow || !res?.props) return res;
                        const ch = res.props.children;
                        if (Array.isArray(ch)) res.props.children = [...ch, iconRow];
                        else res.props.children = [ch, iconRow];
                    } catch {}
                    return res;
                });
                return true;
            } catch { return false; }
        };

        // Deneyeceğimiz tüm TypeName'ler (Discord'un farklı sürümlerinde bunlardan biri çalışır)
        const typeNames = [
            "MemberListItem", "GuildMemberRow", "UserRow", "UserSummaryItem",
            "MessageUsername", "UserTag", "ChatProfile", "ProfileHeader",
            "NameTag", "UsernameTag", "UserNameTag", "Avatar", "UserAvatar",
        ];

        const found: string[] = [];
        for (const name of typeNames) {
            try {
                const mod = getByTypeName(name, { default: true });
                if (mod) {
                    const ok = patchAfter(mod, "default") || patchAfter(mod, "render") || patchAfter(mod, "type");
                    if (ok) found.push(name);
                }
            } catch {}
        }

        // getByProps ile de dene
        const propCombos = [
            ["colorUsername"], ["renderMember"], ["usernameColor"],
            ["renderUsername"], ["getNickOrUserName"], ["getUserTag"],
        ];
        for (const props of propCombos) {
            try {
                const mod = getByProps(...props);
                if (mod) {
                    const ok = patchAfter(mod, "default") || patchAfter(mod, "render");
                    if (ok) found.push(props.join(","));
                }
            } catch {}
        }

        // Sonucu Toast ile göster (kaç komponent bulundu)
        setTimeout(() => {
            if (found.length > 0) {
                Toasts.open({ content: `PI 2.8: ${found.length} komponent bulundu: ${found.slice(0, 3).join(", ")}` });
            } else {
                Toasts.open({ content: "PI 2.8: Hiç komponent bulunamadı :(" });
            }
        }, 3000);
    },

    onStop() { Patcher.unpatchAll(); }
};

registerPlugin(PlatformIndicators);
