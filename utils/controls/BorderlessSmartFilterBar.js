/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/comp/smartfilterbar/SmartFilterBar"],function(S){"use strict";return S.extend("retail.pmr.promotionaloffers.utils.controls.BorderlessSmartFilterBar",{renderer:S.getMetadata().getRenderer(),onAfterRendering:function(){this.$().css({"border":"0 solid black","padding-top":0,"padding-left":0,"padding-right":0});}});});
