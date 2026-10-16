'use strict';
'require view';
'require uci';
'require fs';
'require form';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('advanced', _('EDCCA Configuration'));

		s = m.section(form.TypedSection, 'edcca', _('EDCCA setting'),
			_('EDCCA (Energy Detection Clear Channel Assessment) allows devices to detect channel interference. If the detected signal is below the threshold, the device transmits.'));
		s.anonymous = true;
		s.addremove = false;

		// Enable Toggle
		o = s.option(form.ListValue, "edcca_enable", _("Enable EDCCA Compensation"));
		o.value('0', _("Disabled"));
		o.value('1', _("On - Auto"));
		o.default = '1';

		// Compensation
		o = s.option(form.ListValue, "compensation", _("EDCCA Compensation"), _('Default: -6 | Range: -126 to 126'));
		o.value('-2');
		o.value('-6');
		o.value('-10');
		o.depends('edcca_enable', '1');
		o.datatype = 'integer';
		o.default = '-6';

		// BW20
		o = s.option(form.Value, "thres_0", _("EDCCA BW20"), _('Default: -60 dBm'));
		o.value('-55');
		o.value('-60');
		o.value('-65');
		o.depends('edcca_enable', '1');
		o.datatype = 'integer';
		o.default = '-60';

		// BW40
		o = s.option(form.Value, "thres_1", _("EDCCA BW40"), _('Default: -62 dBm'));
		o.value('-57');
		o.value('-62');
		o.value('-67');
		o.depends('edcca_enable', '1');
		o.datatype = 'integer';
		o.default = '-62';

		// BW80
		o = s.option(form.Value, "thres_2", _("EDCCA BW80"), _('Default: -59 dBm'));
		o.value('-54');
		o.value('-59');
		o.value('-64');
		o.depends('edcca_enable', '1');
		o.datatype = 'integer';
		o.default = '-59';

		// BW160
		o = s.option(form.Value, "thres_3", _("EDCCA BW160"), _('Default: -56 dBm'));
		o.value('-51');
		o.value('-56');
		o.value('-61');
		o.depends('edcca_enable', '1');
		o.datatype = 'integer';
		o.default = '-56';

		/**
		 * Better way to handle WiFi Restart:
		 * Instead of restarting on every option write, we hook into the Map's 
		 * save/apply process so it only happens once.
		 */
		m.apply = function() {
			return this.super('apply').then(function() {
				return fs.exec('/sbin/wifi', ['reload']); 
				// 'reload' is generally safer/faster than down/up
			});
		};

		return m.render();
	},
});