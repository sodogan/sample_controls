/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/Label","sap/m/LabelRenderer"],function(L,a){return L.extend("retail.pmr.promotionaloffers.plugins.terms.controls.freestyle.LabelWithMargin",{metadata:{properties:{marginTop:{type:"sap.ui.core.CSSSize"}}},renderer:{render:function(){return a.render.apply(a,arguments);}},onAfterRendering:function(){this.$().css({marginTop:this.getMarginTop()});}});});
