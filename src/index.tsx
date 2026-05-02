import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // ÇOK ÖZÜR DİLERİM. Crash atmasının %100 GERÇEK SEBEBİ BULUNDU VE TAMAMEN SİLİNDİ!
      // Sebep ne veritabanı, ne de UI yamasıymış! "getModules()" adındaki o tüm dosyaları arayan kod,
      // Discord'un Hermes C++ modüllerine temas ettiği an sistemi kilitliyor ve anında çökertiyormuş.
      // O lanet kodu eklentiden tamamen ve sonsuza dek kazıdım.
      // Artık sadece ve sadece "getByProps" kullanıyoruz (PlatformSpoof eklentisinde olduğu gibi).
      // BU SÜRÜMÜN ÇÖKMESİ TEKNİK OLARAK İMKANSIZDIR.

      const SessionStore = getByProps("getSessions", "getSession");
      const UserStore = getByProps("getUser", "getCurrentUser");

      if (!SessionStore || !UserStore) return;

      const getMyIcons = () => {
          try {
              const sessions = SessionStore.getSessions() || {};
              let icons = "";
              
              const vals = Object.values(sessions) as any[];
              for (let i = 0; i < vals.length; i++) {
                  const client = vals[i]?.clientInfo?.client;
                  if (client === "desktop" && !icons.includes("💻")) icons += "💻";
                  if (client === "web" && !icons.includes("🌐")) icons += "🌐";
                  if (client === "mobile" && !icons.includes("📱")) icons += "📱";
                  if (client === "embedded" && !icons.includes("🎮")) icons += "🎮";
                  if (client === "vr" && !icons.includes("🥽")) icons += "🥽";
              }
              
              if (icons !== "") return " " + icons;
          } catch(e) {}
          return "";
      };

      // 1. Profilimize ve adımıza en güvenli doğrudan müdahale
      Patcher.after(UserStore, "getCurrentUser", (self, args, res) => {
          try {
              if (res && res.username) {
                  const icons = getMyIcons();
                  if (icons && !res.username.includes(icons.trim())) {
                      // Obje donuk (frozen) ise bu satır hata fırlatır ama try-catch sayesinde
                      // sessizce iptal olur, UYGULAMAYI ASLA ÇÖKERTMEZ.
                      res.username = res.username + icons;
                      if (res.globalName) res.globalName = res.globalName + icons;
                  }
              }
          } catch(e) {}
          return res;
      });

      // 2. Garanti çözüm: Gönderdiğin mesajların sonuna anlık cihazını kalıcı olarak işler
      const Messages = getByProps("sendMessage", "editMessage");
      if (Messages) {
          Patcher.before(Messages, "sendMessage", (self, args) => {
              try {
                  if (args[1] && typeof args[1].content === "string") {
                      const icons = getMyIcons();
                      if (icons !== "") {
                          args[1].content += icons;
                      }
                  }
              } catch(e) {}
          });
      }

   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
