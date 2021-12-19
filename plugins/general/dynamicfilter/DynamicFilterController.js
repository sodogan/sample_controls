/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([],function(){function D(a){this.hierarchy=a;this.stores=t(this.hierarchy);}function h(n){for(var k in n){if(n.hasOwnProperty(k)&&jQuery.isNumeric(k)){return true;}}return false;}function t(a,r){r=r||[];for(var k in a){if(a.hasOwnProperty(k)&&jQuery.isNumeric(k)){var c=a[k];t(c,r);if(!c.HierarchyId&&!h(c)){r.push(c);}}}return r;}D.prototype.getStores=function(){return this.stores;};D.prototype.getSelectedStoresCount=function(){return this.stores.filter(function(s){return s.checked;}).length;};return D;},true);
