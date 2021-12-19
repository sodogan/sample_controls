/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([],function(){var b={};b._aViewCache=[];b.getView=function(n,t,i){var k=n+"##"+i+"##"+t;if(k in this._aViewCache){return this._aViewCache[k];}var v=sap.ui.view({viewName:n,type:t});this._aViewCache[k]=v;return v;};return b;});
