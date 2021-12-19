/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils","retail/pmr/promotionaloffers/utils/Models","retail/pmr/promotionaloffers/utils/ExtensibilityConfig"],function(U,M,E){"use strict";function p(a,b){function i(a,j){return function(l){return j.call(a,l);};}return function(j){var l=Promise.resolve(j);b.forEach(function(t){l=l.then(i(a,t));});return l;};}function c(a){return a&&a.hasOwnProperty("results");}function d(a){return a&&a.hasOwnProperty("__deferred");}function u(a){return a.results;}function e(a){return typeof a==="string"||typeof a==="number"||typeof a==="boolean"||typeof a==="undefined"||a===null;}function f(a){var t=a.Terms;if(t){for(var i=0,b=t.length;i<b;i++){var l=t[i].TermProducts;if(!l){continue;}for(var j=0,v=l.length;j<v;j++){var T=l[j];T.ServerUserProjection=T.UserProjection;}}}}function g(a){var t=a.Terms;if(t&&t.length){for(var i=0,b=t.length;i<b;i++){var l=t[i].TermProducts;t[i].UoMs=[{}];delete t[i].Products;if(!l){continue;}for(var j=0,v=l.length;j<v;j++){l[j].UoMs=[{}];}}}}function h(a){var t=a.Terms;if(t&&t.length){for(var i=0,b=t.length;i<b;i++){var l=t[i].TermProducts;if(U.getSchemaVersion()<4){delete t[i].PromoCostPriceCurrency;}if(!l){continue;}for(var j=0,v=l.length;j<v;j++){if(U.getSchemaVersion()<4){delete l[j].PromoCostPriceCurrency;}}}}}function r(a){if(e(a)){return a||{};}if(a instanceof Date){return a;}var b={};Object.keys(a||{}).forEach(function(j){if(j==="EnforceMultiple"){b[j]=a[j];return;}if(U.isInitial(a[j])){b[j]=null;return;}else if(U.isInitial(a[j])){b[j]=null;}else if(jQuery.isArray(a[j])){b[j]=[];for(var i=0;i<a[j].length;i++){b[j][i]=r(a[j][i]);}}else if(typeof a[j]==="object"){b[j]=r(a[j]);}else{b[j]=a[j];}});return b;}function k(a){return jQuery.extend(true,{},a);}function m(){var t=new Date();t.setHours(0,0,0,0);return t;}function n(){var t=m().getTime();var a=60000;var b=1000;var i=24*60*a;return new Date(t+i-b);}function s(a){var b=function(a){for(var i in a){if(a.hasOwnProperty(i)){if(a[i]===""||a[i]===null){if(i!=="Id"&&i!=="Unit"&&i!=="EnforceMultiple"){delete a[i];}}if(Array.isArray(a[i])){a[i].forEach(function(j){if(j instanceof Object){b(j);}});}}}};b(a);return a;}function o(a){return function(b){jQuery.sap.log.getLogger().debug(a,JSON.stringify(b));return b;};}function q(a){if(a.StartOfOffer){a.StartOfOffer=U.getFormatedDateForSave(a.StartOfOffer);}if(a.EndOfOffer){a.EndOfOffer=U.getFormatedDateForSave(a.EndOfOffer);}if(a.Tactics){a.Tactics.forEach(function(t){t.StartOfTactic=U.getFormatedDateForSave(t.StartOfTactic);t.EndOfTactic=U.getFormatedDateForSave(t.EndOfTactic);});}if(a.Versions){a.Versions.forEach(function(v){v.StartOfOffer=U.getFormatedDateForSave(v.StartOfOffer);v.EndOfOffer=U.getFormatedDateForSave(v.EndOfOffer);});}return a;}var R="Terms,Terms/Financials,Terms/TermProducts,Terms/TermProducts/Financials,ExcludedNodes,"+"Terms/Incentives,Incentives,Tactics,VendorFunds,Attributes,AvailableFunds,TargetGroups,"+"Versions,Versions/Terms,Versions/Terms/Financials,Versions/Terms/TermProducts/Financials,Versions/Terms/TermProducts,Versions/Incentives,Versions/Terms/Incentives,LocationHierarchy,"+"LocationHierarchy/Locations,LocationFilters,LocalNodes,LocalNodes/Children";var w=R+",Terms/UoMs,Terms/TermProducts/UoMs,Versions/Terms/UoMs,Versions/Terms/TermProducts/UoMs";var x=w+",Terms/TermProducts/Purposes"+",LocationSubgroups,LocationSubgroups/Filters,LocationSubgroups/Locations,Versions/Terms/TermProducts/Purposes";function C(){}function y(a,b){return function(){return a.service.fetchOfferData(b);};}function z(a){return function(b){return a.processData(b);};}function A(a){g(a);if(Array.isArray(a.Versions)){(a.Versions||[]).forEach(g);}return a;}function B(a){h(a);if(Array.isArray(a.Versions)){(a.Versions||[]).forEach(h);}return a;}function D(a){A(a);B(a);return a;}C.prototype.onInit=function(a){var i=p(a,[y(a,w+E.getExpand()),o("fetched offer data"),z(a)]);var b=p(a,[a._fetchStaticData,a._setStaticData]);return Promise.all([i(),b()]);};C.prototype.saveOffer=function(a,b){return a.service.saveOffer(D(b),w+E.getExpand());};C.prototype.calculateFinancials=function(i,j){return M.getFinancials(D(j)).then(function(l){var t=l.data;var v=U.get(l,["returnedData","__batchResponses"])||[];var T=v.map(function(a){var b=U.get(a,["response","body"]);return b&&b.indexOf("error")>-1;}).reduce(function(a,b){return a||b;},false);if(T){return null;}return i.processData(t);});};C.prototype.calculateForecast=function(i,j){return M.getForecast(D(j)).then(function(l){var t=l.data;var v=U.get(l,["returnedData","__batchResponses"])||[];var T=v.map(function(a){var b=U.get(a,["response","body"]);return b&&b.indexOf("error")>-1;}).reduce(function(a,b){return a||b;},false);if(T){return null;}return i.processData(t);});};C.prototype.detectCollisions=function(a,b){return M.getCollision(D(b));};C.prototype.determineVendorFunds=function(a,b){return M.getVendorFunds(D(b));};function F(){}function y(a,b){return function(){return a.service.fetchOfferData(b);};}function z(a){return function(b){return a.processData(b);};}F.prototype.onInit=function(a){var i=p(a,[y(a,x+E.getExpand()),o("fetched offer data"),z(a)]);var b=p(a,[a._fetchStaticData,a._setStaticData]);return Promise.all([i(),b()]);};function G(a){if(Array.isArray(a.Versions)){(a.Versions||[]).forEach(function(v){delete v.LocationSubgroups;B(v);});}A(a);B(a);return a;};F.prototype.saveOffer=function(a,b){return a.service.saveOffer(G(b),x+E.getExpand());};F.prototype.calculateFinancials=function(i,j){return M.getFinancials(G(j)).then(function(l){var t=l.data;var v=U.get(l,["returnedData","__batchResponses"])||[];var T=v.map(function(a){var b=U.get(a,["response","body"]);return b&&b.indexOf("error")>-1;}).reduce(function(a,b){return a||b;},false);if(T){return null;}return i.processData(t);});};F.prototype.calculateForecast=function(i,j){return M.getForecast(G(j)).then(function(l){var t=l.data;var v=U.get(l,["returnedData","__batchResponses"])||[];var T=v.map(function(a){var b=U.get(a,["response","body"]);return b&&b.indexOf("error")>-1;}).reduce(function(a,b){return a||b;},false);if(T){return null;}return i.processData(t);});};F.prototype.detectCollisions=function(a,b){return M.getCollision(G(b));};F.prototype.determineVendorFunds=function(a,b){return M.getVendorFunds(G(b));};function H(){}function I(a){return a.map(function(b){return{Unit:b.Id};});}var J=U.prop("Id");function K(a,b){var j=U.indexBy(J,b);for(var i=0,l=a.length;i<l;i++){var t=a[i];var v=U.first(j[t.ProductId]);if(!v){continue;}t.UoMs={results:I(v.UnitOfMeasures.results)};t.Description=v.Name;}}function L(a){var t=U.get(a,["Terms","results"])||[];var b=(t||[]).map(function(i){if(!U.isInitial(i.ProductId)){return[i.ProductId,i.DimensionType];}else if(!U.isInitial(i.HierarchyNodeId)){return[i.HierarchyNodeId,i.DimensionType];}else{return[i.HierarchyId,i.DimensionType];}}).map(function(i){return M.getProductById.apply(M,i);});return Promise.all(b).then(function(j){for(var i=0,l=t.length;i<l;i++){var v=t[i];var T=j[i];var V=T.UnitOfMeasures.results;v.UoMs={results:I(V)};v.Description=T.Name;if(v.DimensionType==="01"){v.TermProducts.results[0].UoMs=v.UoMs;v.TermProducts.results[0].Description=v.Description;}else if(v.TermProducts&&v.TermProducts.results){K(v.TermProducts.results,T.Children.results);}}return a;});}function N(a){var b=U.get(a,["data","data"])||U.get(a,["data"]);var i=L(b);var v=(U.get(a,["data","Versions","results"])||[]).map(L);return Promise.all([i].concat(v)).then(function(){return a;});}function O(a,b){return function(){var i=y(a,b)();return i.then(N);};}H.prototype.initializeOfferData=function(a){var i=p(a,[O(a,R+E.getExpand()),o("fetched offer data"),z(a)]);return i();};H.prototype.onInit=function(a){var i=p(a,[a._fetchStaticData,a._setStaticData]);return Promise.all([this.initializeOfferData(a),i()]);};function P(a){var t=a.Terms;var i=0;if(t){for(i=0;i<t.length;i++){t[i].UoMs=undefined;t[i].Description=undefined;var b=t[i].TermProducts;if(b){for(var j=0,l=b.length;j<l;j++){b[j].UoMs=undefined;b[j].Description=undefined;}}}}if(a.Versions){for(i=0;i<a.Versions.length;i++){a.Versions[i]=P(a.Versions[i]);}}return a;}H.prototype.saveOffer=function(a,b){return a.service.saveOffer(P(b)).then(N);};H.prototype.determineVendorFunds=function(a,b){return M.getVendorFunds(P(b)).then(N);};H.prototype.calculateFinancials=function(i,j){return M.getFinancials(P(j)).then(N).then(function(l){var t=l.data;var v=U.get(l,["returnedData","__batchResponses"])||[];var T=v.map(function(a){var b=U.get(a,["response","body"]);return b&&b.indexOf("error")>-1;}).reduce(function(a,b){return a||b;},false);if(T){return null;}return i.processData(t);});};H.prototype.calculateForecast=function(i,j){return M.getForecast(P(j)).then(N).then(function(l){var t=l.data;var v=U.get(l,["returnedData","__batchResponses"])||[];var T=v.map(function(a){var b=U.get(a,["response","body"]);return b&&b.indexOf("error")>-1;}).reduce(function(a,b){return a||b;},false);if(T){return null;}return i.processData(t);});};H.prototype.detectCollisions=function(a,b){return M.getCollision(P(b));};function Q(a,b,i){this.appState=a;this.service=b;this.offerDataProvider=i;this.workflow=a.workflow||new C();this.staticData=null;this.offerData=null;this.snapshot=a.transientSnapshot;}Q.prototype.getStaticData=function(){return this.staticData;};Q.prototype.getOfferData=function(){return this.offerData;};Q.prototype.getHeaders=function(){return this.headers;};Q.prototype.onInit=function(a){a=a||jQuery.noop;var t=this;return new Promise(function(b,i){M.getMetadataAnalyzer().then(function(j){var l=j.getSchemaDefinition();var v=l["sap:schema-version"];U.setSchemaVersion(parseInt(v,10));if(parseInt(v,10)>=2){t.workflow=new F();U.setStatusField("UIState");}else{U.setStatusField("Status");}t.appState.workflow=t.workflow;return b(t.workflow.onInit(t).then(null,function(T){t.workflow=new H();t.appState.workflow=t.workflow;U.setStatusField("Status");U.getMessageManager().removeAllMessages();return t.workflow.onInit(t);}).then(function(j){return Promise.resolve(a());}).then(function(j){t.snapshot=t.createSavePayload();}));});});};Q.prototype._processUserProjections=function(a){f(a);(a.Versions||[]).forEach(f);return a;};Q.prototype.processData=function(a){var b=p(this,[this._storeHeaders,o("stored headers"),r,o("replaced initial with null"),this._stripMetadata,o("strip the metadata"),this._processCollectionObjects,o("unwrap collections and strip defered objects"),this._setupOfferInitalRange,o("setup offer range"),this._setupMasterDataSystem,o("setup master data system"),this._processUserProjections,this._setDefaultValues,this._setOfferData]);return b(a);};var S=(function(){var a={processObject:function processObject(b){if(jQuery.isArray(b)){return;}else if(typeof b==="object"){this.process(b);}},processCollection:function processCollection(b){var j=u(b);for(var i=0;i<j.length;i++){this.process(j[i]);}return j;},process:function S(b){for(var i in b){if(b.hasOwnProperty(i)){if(d(b[i])){delete b[i];}else if(c(b[i])){b[i]=this.processCollection(b[i]);}else{this.processObject(b[i]);}}}return b;}};return a.process.bind(a);}());Q.prototype._processCollectionObjects=function(a){return S(a);};Q.prototype._stripMetadata=function(a){if(!a){return a;}if(a.hasOwnProperty("__metadata")){delete a.__metadata;}if(jQuery.isArray(a)){for(var i=0;i<a.length;i++){this._stripMetadata(a[i]);}}else if(typeof a==="object"){for(var b in a){if(a.hasOwnProperty(b)){this._stripMetadata(a[b]);}}}return a;};Q.prototype._setupOfferInitalRange=function(a){var b=a.StartOfOffer;var i=a.EndOfOffer;if(b){b=U.getFormatedDateForRead(b);}else{b=m();}if(i){i=U.getFormatedDateForRead(i);}else{i=n();}a.StartOfOffer=b;a.EndOfOffer=i;if(a.Tactics){a.Tactics.forEach(function(t){t.StartOfTactic=U.getFormatedDateForRead(t.StartOfTactic);t.EndOfTactic=U.getFormatedDateForRead(t.EndOfTactic);});}if(a.Versions){a.Versions.forEach(function(v){this._setupOfferInitalRange(v);},this);}return a;};Q.prototype._setupMasterDataSystem=function(a){var b=a.MasterdataSystem;if(b){return a;}return this.service.getMasterDataSystem().then(function(i){a.MasterdataSystem=i;return a;});};Q.prototype._setDefaultValues=function(a){a.TargetGroups=a.TargetGroups||[];a.Attributes=a.Attributes||[];a.LocationHierarchy=a.LocationHierarchy||[];a.LocationHierarchy.forEach(function(l){l.Locations=l.Locations||[];});return a;};Q.prototype._storeHeaders=function(a){if(a&&a.response){this.headers=a.response.headers;return a.data;}if(a){return a.data;}return null;};Q.prototype._setOfferData=function(a){this.offerData=k(a);return a;};Q.prototype.setOfferDataProvider=function(a){this.offerDataProvider=a;};Q.prototype._fetchStaticData=function(){return this.service.fetchStaticContent();};Q.prototype._setStaticData=function(a){this.staticData=a;};Q.prototype._updateProductDetailsUserProjection=function(a){var t=a.Terms;if(t){for(var i=0,b=t.length;i<b;i++){var l=t[i].TermProducts;if(!l){continue;}for(var j=0,v=l.length;j<v;j++){var T=l[j];var V=T.ServerUserProjection;var W=T.UserProjection;var X=T.LockUserProjection;if(parseFloat(W)&&W!==V){T.LockUserProjection=true;}else if(W===V&&!X){W="0";}delete T.ServerUserProjection;T.UserProjection=W;}}}if(a.Versions){for(var i=0,Y=a.Versions.length;i<Y;i++){a.Versions[i]=this._updateProductDetailsUserProjection(a.Versions[i]);}}return a;};Q.prototype.createSavePayloadWithFinancials=function(){var a=this.offerDataProvider.getOfferWithFinancials();return s(k(a));};Q.prototype.createSavePayload=function(){var a=this.offerDataProvider.getOfferData();return this._updateProductDetailsUserProjection(s(q(k(a))));};Q.prototype.storeSnapshot=function(a){this.snapshot=a;};Q.prototype.getSnapshot=function(){return this.snapshot;};Q.prototype.hasChanges=function(){return!jQuery.sap.equal(this.snapshot,this.createSavePayload());};Q.prototype.saveOffer=function(){var a=this.createSavePayload();return this.workflow.saveOffer(this,a);};Q.prototype.calculateFinancials=function(a){return this.workflow.calculateFinancials(this,a);};Q.prototype.determineVendorFunds=function(a){return this.workflow.determineVendorFunds(this,a);};Q.prototype.calculateForecast=function(a){return this.workflow.calculateForecast(this,a);};Q.prototype.detectCollisions=function(a){return this.workflow.detectCollisions(this,a);};return Q;},true);