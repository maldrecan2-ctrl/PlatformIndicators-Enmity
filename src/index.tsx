import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
    ...manifest,

    onStart() {
        // ŞEYTANI DEHA YAKLAŞIMI:
        // Discord zaten diğer kullanıcılar için platform ikonlarını (📱 gibi) kendisi çiziyor.
        // Bu çizimi tetikleyen fonksiyon: PresenceStore.getClientStatus(userId)
        // Bu fonksiyon { mobile: "online", desktop: "dnd" } gibi bir obje döndürüyor.
        // Discord bu objeyi alıp kendi orijinal ikonlarını çiziyor.
        // BİZ SADECE KENDİ USER ID'MİZ İÇİN BU FONKSİYONA KENDİ OTURUM VERİMİZİ VERİYORUZ.
        // Discord gerisini halleder. Crash yok, SVG yok, emoji yok. Tamamen orijinal ikonlar!

        const SessionStore  = getByProps("getSessions", "getSession");
        const UserStore     = getByProps("getUser", "getCurrentUser");
        const PresenceStore = getByProps("getClientStatus", "getStatus");

        if (!SessionStore || !UserStore || !PresenceStore) return;

        // Kendi aktif oturumlarımızı Discord'un beklediği formata çevir
        // Format: { desktop: "online", mobile: "dnd" }
        const buildClientStatus = (): Record<string, string> | null => {
            try {
                const sessions = SessionStore.getSessions() || {};
                const clientStatus: Record<string, string> = {};
                for (const s of Object.values(sessions) as any[]) {
                    const client: string = s?.clientInfo?.client;
                    const status: string = s?.status ?? "online";
                    if (client) {
                        clientStatus[client] = status;
                    }
                }
                return Object.keys(clientStatus).length > 0 ? clientStatus : null;
            } catch { return null; }
        };

        // PresenceStore.getClientStatus'u yakala
        // Discord her kullanıcı için bunu çağırır. Sadece kendi ID'miz için kendi verimizi döndürüyoruz.
        Patcher.after(PresenceStore, "getClientStatus", (_self, args, res) => {
            try {
                const userId: string = args[0];
                const currentUser = UserStore.getCurrentUser?.();
                if (!userId || !currentUser || userId !== currentUser.id) return res;

                const myStatus = buildClientStatus();
                if (!myStatus) return res;

                // Eğer zaten veri varsa üstüne yaz, yoksa bizim verimizi döndür
                if (res && typeof res === "object") {
                    return { ...res, ...myStatus };
                }
                return myStatus;
            } catch { return res; }
        });

        // getStatus'u da yakala (genel online/offline durumu için)
        Patcher.after(PresenceStore, "getStatus", (_self, args, res) => {
            try {
                const userId: string = args[0];
                const currentUser = UserStore.getCurrentUser?.();
                if (!userId || !currentUser || userId !== currentUser.id) return res;

                // Eğer halihazırda bir status dönüyorsa dokunma
                if (res && res !== "offline" && res !== "invisible") return res;

                // Yoksa sessionlardan bul
                const sessions = SessionStore.getSessions() || {};
                const vals = Object.values(sessions) as any[];
                if (vals.length > 0 && vals[0]?.status) return vals[0].status;
            } catch {}
            return res;
        });

    },

    onStop() {
        Patcher.unpatchAll();
    }
};

registerPlugin(PlatformIndicators);
