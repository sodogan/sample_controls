/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/core/mvc/Controller","retail/pmr/promotionaloffers/utils/Models"],function(C,M){var t=function(m){return function(){throw new Error("Not implemented: "+m);};};var T=C.extend("retail.pmr.promotionaloffers.plugins.terms.TermsBaseController",{getOfferData:t("getOfferData"),setOfferData:t("setOfferData"),validate:t("validate")});T.getter=function getter(p){return function(){return this[p];};};T.getValidId=function getValidId(){var p=Array.prototype.splice.call(arguments,0);p.push("",null);var h=function(i){return p.reduce(function(r,c){return r||c===i;},false);};return function(i){return h(i)?"":i;};};T.hasValueForProperties=function hasValueForProperties(o,p){return p.reduce(function(r,a){if(!o[a]){return r+1;}return r;},0);};return T;});
