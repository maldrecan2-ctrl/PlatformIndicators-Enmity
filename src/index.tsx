import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getByProps } from 'enmity/metro';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';

const Patcher = create('PlatformIndicators');

const PlatformIndicators: Plugin = {
   ...manifest,

   onStart() {
      // Orijinal Enmity kütüphanesi üzerinden Store'ları bulalım
      const getStore = (name: string) => {
          try {
              return (window as any).enmity?.metro?.getByStoreName?.(name) || null;
          } catch (e) {
              return null;
          }
      };

      const PresenceStore = getStore("PresenceStore") || getByProps("getState", "getPresence");
      const SessionStore = getStore("SessionsStore") || getByProps("getSessions");
      const UserStore = getStore("UserStore") || getByProps("getCurrentUser");

      // İkonları oluşturan yardımcı fonksiyon
      const getPlatformString = (userId: string) => {
          if (!PresenceStore || !UserStore) return " [❓]"; // Store bulunamadıysa soru işareti
          
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
              return " [⚠️]"; // Okuma hatası
          }
          
          if (!statuses) return ""; // Çevrimdışı
          
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

      // KESİN ÇÖZÜM: Arayüz (UI) Yamalarını çöpe atıp, Veri Akışına (FluxDispatcher) sızıyoruz.
      // Discord'un nesneleri dondurulmuş (frozen) olabileceği için her zaman kopyasını (clone) oluşturarak değiştiriyoruz.
      const FluxDispatcher = getByProps("dispatch", "subscribe");
      
      if (FluxDispatcher) {
          Patcher.before(FluxDispatcher, "dispatch", (self, args) => {
              try {
                  const event = args[0];
                  if (!event) return;

                  // 1. Sohbet Mesajlarında İsimlerin Yanına Ekle
                  if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE") {
                      if (event.message && event.message.author) {
                          const iconsStr = getPlatformString(event.message.author.id);
                          if (iconsStr && iconsStr !== "") {
                              const author = event.message.author;
                              const currentGlobalName = author.global_name || author.username;
                              
                              if (!currentGlobalName.includes(iconsStr.trim())) {
                                  // Objenin donukluğunu kırmak için kopyalıyoruz
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
                  // Geçmiş mesajları yüklerken
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
                  // 2. Üye Listesinde İsimlerin Yanına Ekle (Guild Member List)
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
                                                  // Objenin kopyasını al
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
