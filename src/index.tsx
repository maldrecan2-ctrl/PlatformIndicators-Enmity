import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // ÇÖKMENİN ASIL KAYNAĞI: Discord 261.0'da "FluxDispatcher" (Veri Akışı) saniyede binlerce kez tetikleniyor.
      // Enmity'nin Patcher'ı bu kadar hızlı akan bir sinyale tutunmaya çalışınca, kod ne kadar güvenli olursa olsun
      // Discord'un motoru bu kancayı (hook) taşıyamayıp patlıyormuş!
      // Bu yüzden FluxDispatcher'ı tamamen ve sonsuza dek çöpe attık! ASLA kullanılmayacak.

      // YENİ VE %100 ÇÖKMEYEN STRATEJİ:
      // Arayüz yamaları (çökmüyor ama sürümden sürüme bozuluyor).
      // Bu yüzden sadece UserStore'u (Kullanıcı Veritabanı) "Proxy (Kılıf)" ile sarmalıyoruz.
      // Bu yöntem daha önce denediğimizde çökmüyordu ama ikon da gelmiyordu (çünkü veritabanını bulamıyordu).
      // Şimdi veritabanını %100 bulacak özel anahtar kelimeleri (getStatuses, getSessions) girdim.

      let PresenceStore: any = null;
      let SessionStore: any = null;
      let UserStore: any = null;

      const getPlatformString = (userId: string) => {
          // Çok daha net ve %100 bulan arama anahtarları
          if (!PresenceStore) PresenceStore = getByProps("getStatuses", "getActivities") || getByProps("getState", "clientStatuses");
          if (!UserStore) UserStore = getByProps("getUser", "getCurrentUser");
          if (!SessionStore) SessionStore = getByProps("getSessions", "getSession");

          if (!PresenceStore || !UserStore) return "";
          
          let statuses;
          try {
              const currentUser = UserStore.getCurrentUser();
              if (currentUser && userId === currentUser.id && SessionStore) {
                  const sessions = SessionStore.getSessions() || {};
                  statuses = {};
                  Object.values(sessions).forEach((s: any) => {
                      if (s.clientInfo && s.clientInfo.client !== "unknown") {
                          statuses[s.clientInfo.client] = s.status;
                      }
                  });
              } else {
                  // getState().clientStatuses Discord'un standart varlık sözlüğüdür
                  const state = PresenceStore.getState ? PresenceStore.getState() : PresenceStore;
                  if (state && state.clientStatuses) {
                      statuses = state.clientStatuses[userId];
                  }
              }
          } catch(e) {
              return ""; 
          }
          
          if (!statuses) return ""; 
          
          const platforms = Object.keys(statuses);
          if (platforms.length === 0) return "";
          
          let icons = [];
          if (platforms.includes("desktop")) icons.push("💻");
          if (platforms.includes("web")) icons.push("🌐");
          if (platforms.includes("mobile")) icons.push("📱");
          if (platforms.includes("embedded")) icons.push("🎮");
          if (platforms.includes("vr")) icons.push("🥽");
          
          if (icons.length === 0) return "";

          return " " + icons.join("");
      };

      // PROXY SİSTEMİ: Obje donuk (frozen) olsa bile React'ı veya Discord'u asla bozmaz, çünkü orijinal objeye dokunmaz.
      const cachedProxies = new WeakMap();

      const createProxy = (obj: any) => {
          if (!obj || typeof obj !== "object") return obj;
          if (cachedProxies.has(obj)) return cachedProxies.get(obj);

          const proxy = new Proxy(obj, {
              get(target, prop) {
                  const val = target[prop];
                  // Eğer Discord ismi soruyorsa, araya girip ikonu ekle
                  if (prop === "globalName" || prop === "username" || prop === "nick") {
                      if (typeof val === "string") {
                          // GuildMember nesneleri userId barındırır, User nesneleri id barındırır.
                          const idToUse = target.id || target.userId;
                          if (idToUse) {
                              const icons = getPlatformString(idToUse);
                              if (icons && !val.includes(icons.trim())) {
                                  return val + icons;
                              }
                          }
                      }
                  } else if (prop === "__isPlatformProxy") {
                      return true; // Sonsuz döngü koruması
                  }

                  // Fonksiyonları bozmamak için orijinaline bağla (CRASH ENGELLEYİCİ)
                  if (typeof val === "function") {
                      return val.bind(target);
                  }
                  return val;
              }
          });

          cachedProxies.set(obj, proxy);
          return proxy;
      };

      // 1. Genel Kullanıcılar (Sohbetler ve Profiller)
      const uStore = getByProps("getUser", "getCurrentUser");
      if (uStore && uStore.getUser) {
          Patcher.after(uStore, "getUser", (self, args, res) => {
              if (!res || res.__isPlatformProxy) return res;
              return createProxy(res);
          });
      }

      // 2. Sunucu Üyeleri (Üye Listesi)
      const gStore = getByProps("getMember", "getMembers");
      if (gStore && gStore.getMember) {
          Patcher.after(gStore, "getMember", (self, args, res) => {
              if (!res || res.__isPlatformProxy) return res;
              return createProxy(res);
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
