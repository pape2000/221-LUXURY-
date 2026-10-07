// 221 LUXURY — configuration publique Supabase
// Cette clé est une Publishable key, prévue pour être exposée dans le code navigateur.
// NE JAMAIS placer ici une secret key / service_role.
window.__221LUXURY_SUPABASE__ = {
  url: 'https://shvgcroqovnhltpzceid.supabase.co',
  publishableKey: 'sb_publishable_t3OcJB8q9BXNcMX2Wt0ngw_xvoms06r'
};

// Le catalogue public doit toujours se resynchroniser depuis Supabase.
// Le runtime attend le chargement du catalogue original puis remplace son
// contenu avec les données live. Il reste inactif sur le gestionnaire.
(function(){
  if(location.pathname === '/' || location.pathname === '' || location.pathname === '/index.html'){
    if(!document.querySelector('script[data-221luxury-public-runtime]')){
      var s=document.createElement('script');
      s.src='/221-luxury-supabase-runtime.js?v=live-4';
      s.async=false;
      s.setAttribute('data-221luxury-public-runtime','1');
      (document.head||document.documentElement).appendChild(s);
    }
  }
})();