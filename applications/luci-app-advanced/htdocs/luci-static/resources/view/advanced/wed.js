'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require ui';
'require rpc';

return view.extend({
	callReboot: rpc.declare({
		object: 'system',
		method: 'reboot',
		expect: { result: 0 }
	}),

	callSetWED: rpc.declare({
		object: 'luci',
		method: 'setWED',
		params: [ 'enabled' ],
		expect: { enabled: false }
	}),

	callGetWED: rpc.declare({
		object: 'luci',
		method: 'getWED',
		expect: { enabled: false }
	}),

	render: function() {
		let m, s, o;

		m = new form.Map('advanced', _('Advanced Wireless Settings'));

		s = m.section(form.TypedSection, 'defaults', _('Kernel Module & Hardware Acceleration'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('wed_tab', _('WED (mt7915e)'));
		s.tab('atf_tab', _('Airtime Fairness'));

		/*
		 * WED TAB
		 */
		o = s.taboption('wed_tab', form.ListValue, "wed_enable", _("WED Mode"),
			_("Enabling this modifies /etc/modules.d/mt7915e and requires a reboot."));
		o.value('0', _("Disabled"));
		o.value('1', _("Enabled"));
		o.rmempty = false;

		o.load = L.bind(function(section_id) {
			return this.callGetWED().then(L.bind(function(enabled) {
				let wedState = enabled ? '1' : '0';
				let uciValue = uci.get('advanced', section_id, 'wed_enable');
				
				// Sync UCI with actual module state if different
				if (uciValue != wedState) {
					uci.set('advanced', section_id, 'wed_enable', wedState);
				}
				
				return wedState;
			}, this)).catch(function(e) {
				console.error('Failed to get WED state:', e);
				// Fallback to UCI value
				return uci.get('advanced', section_id, 'wed_enable') || '0';
			});
		}, this);

		o.write = L.bind(function(section_id, value) {
			let enabled = (value === '1');
			
			return this.callSetWED(enabled).then(L.bind(function(result) {
				uci.set('advanced', section_id, 'wed_enable', value);
				ui.addNotification(null, 
					enabled ? _('WED enabled. Reboot required to take effect.') 
						   : _('WED disabled. Reboot required to take effect.'), 
					'info');
				return value;
			}, this)).catch(function(e) {
				console.error('Failed to set WED:', e);
				ui.addNotification(null, _('Error updating WED: ') + e.message, 'danger');
				throw e;
			});
		}, this);

		/*
		 * ATF TAB
		 */
		// Basic ATF - Depends only on WED being enabled
		o = s.taboption('atf_tab', form.ListValue, "atf_enable", _("Enable ATF"));
		o.value('0', _("Off"));
		o.value('1', _("On"));
		o.depends('wed_enable', '1');
		o.write = function(section_id, value) {
			uci.set('advanced', section_id, 'atf_enable', value);
			return fs.exec("/etc/init.d/advanced_setup", ["reload", "atf"])
				.then(function() {
					ui.addNotification(null, _('ATF configuration updated.'), 'info');
				})
				.catch(function(err) {
					console.error(err);
					ui.addNotification(null, _('Failed to reload ATF configuration.'), 'warning');
				});
		};

		// HW ATF - Depends on WED enabled AND hardware feature 'vow'
		if (L.hasSystemFeature('vow')) {
			o = s.taboption('atf_tab', form.ListValue, "hw_atf_enable", _("Enable HW ATF"));
			o.value('0', _("Off"));
			o.value('1', _("On"));
			o.depends('wed_enable', '1');
			o.write = function(section_id, value) {
				uci.set('advanced', section_id, 'hw_atf_enable', value);
				return fs.exec("/etc/init.d/advanced_setup", ["reload", "atf"])
					.then(function() {
						ui.addNotification(null, _('HW ATF configuration updated.'), 'info');
					})
					.catch(function(err) {
						console.error(err);
						ui.addNotification(null, _('Failed to reload HW ATF configuration.'), 'warning');
					});
			};
		}

		/*
		* SYSTEM ACTIONS - Reboot with Script-Based Heartbeat
		*/
		s = m.section(form.TypedSection, 'defaults', _('System Actions'));
		s.anonymous = true;

		o = s.option(form.Button, '_reboot_btn', _('Apply & Reboot Device'));
		o.inputstyle = 'negative';
		o.inputtitle = _('Reboot Now');

		o.onclick = L.bind(function(ev) {
			if (!confirm(_('Reboot now? Changes will be applied and connections dropped.')))
				return;

			// Show the official modal
			ui.showModal(_('Rebooting...'), [
				E('p', { 'class': 'spinning' }, _('The system is rebooting. This page will reload automatically once the connection is restored.'))
			]);

			// Trigger the Reboot
			this.callReboot().then(L.bind(function() {

				let checkBack = function() {
					// We use a <script> tag to check for the server.
					// Browsers allow script loads across "untrusted" SSL boundaries
					// much more easily than fetch() or XHR.
					let script = document.createElement('script');

					script.onload = function() {
						// If the script loads (or even starts to load), the server is up
						window.location.reload();
					};

					script.onerror = function() {
						// Server still down or certificate not yet accepted by the browser
						// We'll clean up and try again in 5 seconds
						document.body.removeChild(script);
						window.setTimeout(checkBack, 5000);
					};

					// luci.js is a CORE file. If it's missing, LuCI isn't installed.
					script.src = window.location.protocol + '//' + window.location.hostname +
								'/luci-static/resources/luci.js?r=' + Math.random();

					document.body.appendChild(script);
				};

				// Wait 25 seconds before we start the first check
				window.setTimeout(checkBack, 25000);

			}, this));
		}, this);

		return m.render();
	}
});