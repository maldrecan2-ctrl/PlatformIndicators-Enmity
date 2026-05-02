import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { Toasts } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import { find } from 'enmity/api/assets';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
    ...manifest,

    onStart() {
        // TEST MODU: Discord'un içindeki tüm asset isimlerinden platform ile ilgili olanları bul
        // ve ekrana TOAST bildirimi olarak göster. 
        // Bu sayede doğru isimleri öğreneceğiz!
        try {
            const keywords = ["phone", "mobile", "desktop", "monitor", "globe", "web", "controller", "console", "vr", "headset", "platform", "device"];
            const found: Record<string, string[]> = {};
            
            for (const kw of keywords) {
                try {
                    const results: string[] = [];
                    // find() ile tüm assetleri tara
                    let asset = find((a: any) => a?.name?.toLowerCase()?.includes(kw));
                    if (asset?.name) results.push(asset.name);
                    if (results.length > 0) found[kw] = results;
                } catch {}
            }
            
            const foundStr = Object.entries(found)
                .map(([k, v]) => `${k}: ${v.join(", ")}`)
                .join(" | ");
            
            if (foundStr) {
                // İlk 100 karakter (Toast sınırlı)
                Toasts.open({ content: "PI Assets: " + foundStr.slice(0, 120) });
            } else {
                Toasts.open({ content: "PI: Hiç asset bulunamadı!" });
            }
        } catch(e) {
            Toasts.open({ content: "PI Test Hatası: " + String(e).slice(0, 80) });
        }

        // Çalışan temel sürümü de aktif bırak
        const SessionStore = getByProps("getSessions", "getSession");
        const UserStore    = getByProps("getUser", "getCurrentUser");
        if (!SessionStore || !UserStore) return;

        const buildStr = (): string => {
            try {
                const seen = new Set<string>();
                let r = "";
                for (const s of Object.values(SessionStore.getSessions() || {}) as any[]) {
                    const c: string = s?.clientInfo?.client;
                    if (c && !seen.has(c)) {
                        seen.add(c);
                        const m: Record<string, string> = {
                            desktop:  " \u{1F5A5}",
                            mobile:   " \u{1F4F1}",
                            web:      " \u{1F310}",
                            embedded: " \u{1F3AE}",
                            vr:       " \u{1F97D}",
                        };
                        r += m[c] ?? "";
                    }
                }
                return r;
            } catch { return ""; }
        };

        Patcher.after(UserStore, "getCurrentUser", (_s, _a, res) => {
            try {
                if (res?.username) {
                    const icons = buildStr();
                    if (icons && !res.username.includes(icons.trim())) {
                        return Object.assign(Object.create(Object.getPrototypeOf(res)), res, {
                            username:   res.username + icons,
                            globalName: res.globalName ? res.globalName + icons : res.globalName,
                        });
                    }
                }
            } catch {}
            return res;
        });
    },

    onStop() {
        Patcher.unpatchAll();
    }
};

registerPlugin(PlatformIndicators);
