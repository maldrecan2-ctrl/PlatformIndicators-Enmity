import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps, getModules } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // HARİKA HABER! Demek ki Enmity çalışıyor ve sabahtan beri FluxDispatcher (Veri Yaması) başkalarının
      // mesajlarında kusursuzca işliyormuş! Kendi mesajlarında çıkmamasının sebebi, sen mesajı gönderdiğinde
      // Discord'un bunu sunucudan beklemeden direkt ekrana basması.
      // Şimdi bu yamanın en stabil ve kusursuz versiyonunu (ve senin kendi mesajlarını da anında algılayan
      // sürümünü) yazıyoruz. (Şimdilik çökmeye sebep olmaması için standart Emojilerle (💻,📱) çalışacak).

      const findStore = (name: string) => {
          try {
              const modules = getModules() || [];
              for (const m of modules) {
                  if (m && m.default && typeof m.default.getName === "function" && m.default.getName() === name) return m.default;
                  if (m && typeof m.getName === "function" && m.getName() === name) return m;
              }
          } catch(e) {}
          return null;
      };

      let PresenceStore: any = null;
      let SessionStore: any = null;
      let UserStore: any = null;

      const getPlatformString = (userId: string) => {
          if (!PresenceStore) PresenceStore = findStore("PresenceStore") || getByProps("getState", "getPresence", "getActivities");
          if (!UserStore) UserStore = findStore("UserStore") || getByProps("getUser", "getCurrentUser");
          if (!SessionStore) SessionStore = findStore("SessionsStore") || getByProps("getSessions");

          if (!PresenceStore || !UserStore) return "";
          
          let statuses;
          try {
              const currentUser = UserStore.getCurrentUser();
              // Eğer bakan kişi kullanıcının kendisiyse, SessionStore'dan kendi aktif cihazını bulur.
              if (currentUser && userId === currentUser.id && SessionStore) {
                  const sessions = SessionStore.getSessions() || {};
                  statuses = {};
                  Object.values(sessions).forEach((s: any) => {
                      if (s.clientInfo && s.clientInfo.client !== "unknown") {
                          statuses[s.clientInfo.client] = s.status;
                      }
                  });
              } else {
                  statuses = PresenceStore.getState()?.clientStatuses?.[userId];
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

      const Dispatcher = getByProps('dispatch', 'subscribe') || findStore("Dispatcher");
      
      if (Dispatcher) {
          Patcher.before(Dispatcher, 'dispatch', (self, args) => {
              try {
                  const event = args[0];
                  if (!event) return;

                  // MESSAGE_CREATE başkalarının mesajları, MESSAGE_SEND ise senin gönderdiğin anlık mesajlar!
                  if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE" || event.type === "MESSAGE_SEND") {
                      if (event.message && event.message.author) {
                          const iconsStr = getPlatformString(event.message.author.id);
                          if (iconsStr && iconsStr !== "") {
                              const author = event.message.author;
                              const currentGlobalName = author.global_name || author.username;
                              
                              if (!currentGlobalName.includes(iconsStr.trim())) {
                                  event.message = {
                                      ...event.message,
                                      author: {
                                          ...author,
                                          global_name: currentGlobalName + iconsStr,
                                          username: author.username + iconsStr
                                      }
                                  };
                              }
                          }
                      }
                  } 
                  else if (event.type === "LOAD_MESSAGES_SUCCESS") {
                      if (Array.isArray(event.messages)) {
                          event.messages = event.messages.map((m: any) => {
                              if (m && m.author) {
                                  const iconsStr = getPlatformString(m.author.id);
                                  if (iconsStr && iconsStr !== "") {
                                      const currentGlobalName = m.author.global_name || m.author.username;
                                      if (!currentGlobalName.includes(iconsStr.trim())) {
                                          return {
                                              ...m,
                                              author: {
                                                  ...m.author,
                                                  global_name: currentGlobalName + iconsStr,
                                                  username: m.author.username + iconsStr
                                              }
                                          };
                                      }
                                  }
                              }
                              return m;
                          });
                      }
                  }
                  // Sunucu Üye Listesi için yama
                  else if (event.type === "GUILD_MEMBER_LIST_UPDATE") {
                      if (Array.isArray(event.groups)) {
                          event.groups.forEach((group: any) => {
                              if (Array.isArray(group.items)) {
                                  group.items.forEach((item: any) => {
                                      if (item.member && item.member.user) {
                                          const iconsStr = getPlatformString(item.member.user.id);
                                          if (iconsStr && iconsStr !== "") {
                                              const user = item.member.user;
                                              const currentGlobalName = user.global_name || user.username;
                                              if (!currentGlobalName.includes(iconsStr.trim())) {
                                                  item.member = {
                                                      ...item.member,
                                                      user: {
                                                          ...user,
                                                          global_name: currentGlobalName + iconsStr,
                                                          username: user.username + iconsStr
                                                      }
                                                  };
                                              }
                                          }
                                      }
                                  });
                              }
                          });
                      }
                  }
              } catch (e) {}
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
