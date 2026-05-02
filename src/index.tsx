import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('MyPlatformIndicator');

const MyPlatformIndicator: Plugin = {
   ...manifest,

   onStart() {
      // SADECE KENDİ CİHAZINI GÖSTEREN YEPYENİ EKLENTİ
      // Başkalarının veritabanlarına girmeyi bıraktık. Sadece kendi oturumlarımıza (Sessions) bakıyoruz.
      // Bu sayede Discord'u asla yormayacak ve %100 risksiz, çökmeyen bir sistem kurduk.

      const SessionStore = getByProps("getSessions", "getSession");
      const UserStore = getByProps("getUser", "getCurrentUser");

      // Eğer gerekli modüller bulunamazsa sessizce dur, çökmeyi engelle
      if (!SessionStore || !UserStore) return;

      const getMyIcons = () => {
          try {
              // Sadece bizim cihazlarımızın olduğu Oturum veritabanı
              const sessions = SessionStore.getSessions() || {};
              let icons: string[] = [];
              
              Object.values(sessions).forEach((s: any) => {
                  if (s.clientInfo && s.clientInfo.client) {
                      const client = s.clientInfo.client;
                      // Hangi cihazlardan girildiyse hepsini ekle
                      if (client === "desktop" && !icons.includes("💻")) icons.push("💻");
                      if (client === "web" && !icons.includes("🌐")) icons.push("🌐");
                      if (client === "mobile" && !icons.includes("📱")) icons.push("📱");
                      if (client === "embedded" && !icons.includes("🎮")) icons.push("🎮");
                      if (client === "vr" && !icons.includes("🥽")) icons.push("🥽");
                  }
              });
              
              if (icons.length > 0) return " " + icons.join("");
          } catch(e) {}
          return "";
      };

      // Kendi kullanıcı objemizi korumaya alan görünmez kılıf (Proxy)
      const cachedProxies = new WeakMap();

      const createProxy = (userObj: any) => {
          if (!userObj || typeof userObj !== "object") return userObj;
          if (cachedProxies.has(userObj)) return cachedProxies.get(userObj);

          const proxy = new Proxy(userObj, {
              get(target, prop) {
                  const val = target[prop];
                  
                  // Discord sadece bizim ismimizi ekrana çizerken araya giriyoruz
                  if (prop === "globalName" || prop === "username") {
                      if (typeof val === "string") {
                          const icons = getMyIcons();
                          if (icons && !val.includes(icons.trim())) {
                              return val + icons; // İsmin sonuna aktif cihazları ekle
                          }
                      }
                  } else if (prop === "__myPlatformProxy") {
                      return true;
                  }

                  if (typeof val === "function") return val.bind(target);
                  return val;
              }
          });

          cachedProxies.set(userObj, proxy);
          return proxy;
      };

      // Discord ne zaman bir kullanıcı bilgisini çağırsa:
      Patcher.after(UserStore, "getUser", (self, args, res) => {
          if (!res || res.__myPlatformProxy) return res;
          
          const currentUser = UserStore.getCurrentUser();
          // ÇAĞRILAN KİŞİ BİZ İSEK:
          if (currentUser && res.id === currentUser.id) {
              return createProxy(res);
          }
          return res;
      });

      // Profilimize girdiğimizde veya ayarlara tıkladığımızda:
      Patcher.after(UserStore, "getCurrentUser", (self, args, res) => {
          if (!res || res.__myPlatformProxy) return res;
          return createProxy(res);
      });
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(MyPlatformIndicator);
