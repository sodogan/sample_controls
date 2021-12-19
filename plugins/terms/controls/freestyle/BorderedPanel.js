/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/Panel","sap/m/PanelRenderer"],function(P,a){"use strict";return P.extend("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.BorderedPanel",{persistencyKey:"",config:"",init:function(){P.prototype.init.apply(this,arguments);},renderer:a.render,onAfterRendering:function(){this.$().find(".sapMPanelBGTranslucent.sapMPanelContent").css({borderLeft:"1px solid #dddddd",borderRight:"1px solid #dddddd"});}});});
