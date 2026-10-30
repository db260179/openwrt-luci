'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';
'require rpc';

return view.extend({
   // System reboot RPC
   callReboot: rpc.declare({
      object: 'system',
      method: 'reboot',
      expect: { result: 0 }
   }),

   render: function() {
      let m, s, o;

      m = new form.Map('advanced', _('Advanced Wireless Settings'));

      s = m.section(form.TypedSection, 'defaults', _('Kernel Module & Hardware Acceleration'));
      s.anonymous = true;
      s.addremove = false;

      s.tab('wed_tab', _('Wireless Ethernet Dispatch (WED) (mt7915e)'));

      /*
       * WED TAB - Status & Configuration
       */

      // WED Status: Strictly reflects the saved UCI state
      o = s.taboption('wed_tab', form.DummyValue, '_wed_status', _('Current WED State'));
      o.rawhtml = true;
      o.cfgvalue = function(section_id) {
         let configEnabled = uci.get('advanced', section_id, 'wed_enable') === '1';
         return configEnabled ?
            '<span class="label success">' + _('Running (Enabled)') + '</span>' :
            '<span class="label">' + _('Stopped (Disabled)') + '</span>';
      };

      o = s.taboption('wed_tab', form.ListValue, "wed_enable", _("WED Mode"),
         _("Enabling this modifies /etc/modules.d/mt7915e directly. A reboot is required to reload the kernel module."));
      o.value('0', _("Disabled"));
      o.value('1', _("Enabled"));
      o.rmempty = false;

      o.load = L.bind(function(section_id) {
         return fs.read('/etc/modules.d/mt7915e').then(L.bind(function(content) {
            let isEnabled = (content && content.indexOf('wed_enable=1') !== -1);
            let state = isEnabled ? '1' : '0';
            uci.set('advanced', section_id, 'wed_enable', state);
            return state;
         }, this)).catch(function(e) {
            return uci.get('advanced', section_id, 'wed_enable') || '0';
         });
      }, this);

      o.write = L.bind(function(section_id, value) {
         let fileContent = (value === '1') ? 'mt7915e wed_enable=1\n' : 'mt7915e\n';
         return fs.write('/etc/modules.d/mt7915e', fileContent, 420).then(L.bind(function() {
            uci.set('advanced', section_id, 'wed_enable', value);
            ui.addNotification(null, _('Module configuration saved. Reboot required.'), 'info');
         }, this)).catch(function(e) {
            ui.addNotification(null, _('Failed to write /etc/modules.d/mt7915e: ') + e.message, 'danger');
         });
      }, this);

      /*
      * SYSTEM ACTIONS (Original Reboot Logic)
      */
      s = m.section(form.TypedSection, 'defaults', _('System Actions'));
      s.anonymous = true;

      o = s.option(form.Button, '_reboot_btn', _('Apply & Reboot Device'));
      o.inputstyle = 'negative';
      o.inputtitle = _('Reboot Now');

      o.onclick = L.bind(function(ev) {
         if (!confirm(_('Reboot now? Changes will be applied and connections dropped.')))
            return;

         ui.showModal(_('Rebooting...'), [
            E('p', { 'class': 'spinning' }, _('The system is rebooting. This page will reload automatically once the connection is restored.'))
         ]);

         this.callReboot().then(L.bind(function() {
            let checkBack = function() {
               let script = document.createElement('script');
               script.onload = function() { window.location.reload(); };
               script.onerror = function() {
                  document.body.removeChild(script);
                  window.setTimeout(checkBack, 5000);
               };
               script.src = window.location.protocol + '//' + window.location.hostname +
                        '/luci-static/resources/luci.js?r=' + Math.random();
               document.body.appendChild(script);
            };
            window.setTimeout(checkBack, 25000);
         }, this));
      }, this);

      return m.render();
   }
});