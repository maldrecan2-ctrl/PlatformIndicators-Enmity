import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps, getModules } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // 1. DÜNYANIN EN BASİT VE KESİN VERİ YAMASI: Sadece getModules kullanacağız!
      // Enmity'nin çalışmadığından değil, doğru modülleri bulamadığımızdan eminim.
      
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

      const FluxDispatcher = getByProps("dispatch", "subscribe") || findStore("Dispatcher");
      
      let PresenceStore: any = null;
      let SessionStore: any = null;
      let UserStore: any = null;

      const getPlatformString = (userId: string) => {
          if (!PresenceStore) PresenceStore = findStore("PresenceStore") || getByProps("getState", "getPresence", "getActivities");
          if (!UserStore) UserStore = findStore("UserStore") || getByProps("getUser", "getCurrentUser");
          if (!SessionStore) SessionStore = findStore("SessionsStore") || getByProps("getSessions");

          // Eğer hala bulamadıysak, ekrana mutlaka hata sembolünü basıyoruz ki bilelim!
          if (!PresenceStore || !UserStore) return " [❓STORE_YOK]";
          
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
                  statuses = PresenceStore.getState()?.clientStatuses?.[userId];
              }
          } catch(e) {
              return " [⚠️HATA]"; 
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

      // Eğer Patcher gerçekten çalışıyorsa, en azından giden mesajı değiştirecektir.
      const Messages = getByProps("sendMessage", "editMessage");
      if (Messages) {
          Patcher.before(Messages, "sendMessage", (self, args) => {
              if (args && args[1]) {
                  // Kendimize ait cihazımızı anlık ekleyelim
                  const myId = UserStore ? UserStore.getCurrentUser()?.id : null;
                  const myIcons = myId ? getPlatformString(myId) : " [❓TEST]";
                  args[1].content += "\n(Eklenti Çalışıyor)" + myIcons;
              }
          });
      }

      // Veri akışına kalıcı sızma (Sohbet isimleri için)
      if (FluxDispatcher) {
          Patcher.before(FluxDispatcher, "dispatch", (self, args) => {
              try {
                  const event = args[0];
                  if (!event) return;

                  if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE") {
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
              } catch (e) {}
          });
      }
   },

   onStop() {
      Patcher.unpatchAll();
   }
};

registerPlugin(PlatformIndicators);
