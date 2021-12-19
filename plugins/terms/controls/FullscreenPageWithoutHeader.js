/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/semantic/FullscreenPage"],function(F){"use strict";return F.extend("retail.pmr.promotionaloffers.plugins.terms.controls.FullscreenPageWithoutHeader",{onAfterRendering:function(){if(sap.ui.version<="1.42.12"){var d=this.getDomRef();jQuery("div > header",d).first().hide();jQuery("div > section",d).first().css("top","0px");}},renderer:sap.m.semantic.FullscreenPageRenderer});});
