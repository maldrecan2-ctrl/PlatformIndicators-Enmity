import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // Discord'un tüm Veritabanlarını (Store) kesin olarak bulmamızı sağlayan özel tarayıcı.
      // Discord'da her Store'un bir .getName() fonksiyonu vardır!
      const getByStoreName = (name: string) => {
          try {
              const modules = (window as any).enmity?.metro?.getModules?.() || [];
              for (const m of modules) {
                  if (m && m.default && typeof m.default.getName === "function" && m.default.getName() === name) {
                      return m.default;
                  }
                  if (m && typeof m.getName === "function" && m.getName() === name) {
                      return m;
                  }
              }
          } catch(e) {}
          return null;
      };

      let PresenceStore: any = null;
      let SessionStore: any = null;
      let UserStore: any = null;

      const getPlatformString = (userId: string) => {
          if (!PresenceStore) PresenceStore = getByStoreName("PresenceStore");
          if (!UserStore) UserStore = getByStoreName("UserStore");
          if (!SessionStore) SessionStore = getByStoreName("SessionsStore");

          if (!PresenceStore || !UserStore) return " [❓]";
          
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
                  const state = PresenceStore.getState();
                  if (state && state.clientStatuses) {
                      statuses = state.clientStatuses[userId];
                  }
              }
          } catch(e) {
              return " [⚠️]"; 
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

      // KESİN VE KALICI VERİ YAMASI:
      // Kullanıcı veritabanından (UserStore) biri her çağrıldığında anında araya girip ismini değiştiriyoruz.
      // Böylece ekranlar değişse bile veritabanından veri her çekildiğinde isimler ikonlu gelecek.
      
      const patchUserStore = () => {
          const store = getByStoreName("UserStore");
          if (!store) return;
          
          Patcher.after(store, "getUser", (self, args, res) => {
              if (!res || res.__platformPatched) return res;
              
              const iconsStr = getPlatformString(res.id);
              if (iconsStr && iconsStr !== "") {
                  // Orijinal objeyi bozmamak ve React donmalarını (frozen object) aşmak için 
                  // objenin tam bir klonunu oluşturup onun üzerinde değişiklik yapıyoruz.
                  const clonedUser = Object.create(Object.getPrototypeOf(res));
                  Object.assign(clonedUser, res);
                  
                  const currentGlobalName = clonedUser.globalName || clonedUser.username;
                  if (!currentGlobalName.includes(iconsStr.trim())) {
                      clonedUser.username = clonedUser.username + iconsStr;
                      if (clonedUser.globalName) clonedUser.globalName = clonedUser.globalName + iconsStr;
                      clonedUser.__platformPatched = true; // Sonsuz döngüyü engelle
                      return clonedUser;
                  }
              }
              return res;
          });
      };

      // Aynı işlemi sunucu üye listesi (GuildMemberStore) için de yapıyoruz.
      const patchGuildMemberStore = () => {
          const store = getByStoreName("GuildMemberStore");
          if (!store) return;
          
          Patcher.after(store, "getMember", (self, args, res) => {
              if (!res || res.__platformPatched) return res;
              
              // getMember'ın 2. argümanı userId'dir (0. argüman guildId)
              const userId = args[1] || res.userId;
              if (!userId) return res;

              const iconsStr = getPlatformString(userId);
              if (iconsStr && iconsStr !== "") {
                  const clonedMember = Object.create(Object.getPrototypeOf(res));
                  Object.assign(clonedMember, res);
                  
                  const currentNick = clonedMember.nick;
                  if (currentNick) {
                      if (!currentNick.includes(iconsStr.trim())) {
                          clonedMember.nick = currentNick + iconsStr;
                          clonedMember.__platformPatched = true;
                          return clonedMember;
                      }
                  } else {
                      clonedMember.nick = iconsStr;
                      clonedMember.__platformPatched = true;
                      return clonedMember;
                  }
              }
              return res;
          });
      };

      // FluxDispatcher yamasını çöpe atıyoruz, çünkü menü geçişlerinde veri yenilenmezse ikonlar gidiyor.
      // Sadece ana veritabanlarını (Store) yamalamak en kalıcı çözümdür.
      
      // Biraz gecikmeli olarak yamaları uygula ki Discord Store'ları belleğe tamamen yüklemiş olsun
      setTimeout(() => {
          patchUserStore();
          patchGuildMemberStore();
      }, 3000);

   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
