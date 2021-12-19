/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils"],function(U){"use strict";var s={RECOMENDED_STATUS:"04",APPROVED_STATUS:"06"};var a={EDITABLE_ALL_OFFER:0,EDITABLE_HEADER:5,READONLY:10};function S(b){this.stateField=b||"Status";}S.prototype.setFieldName=function(b){this.stateField=b;};S.prototype.getFieldName=function(b){return this.stateField||"Status";};S.prototype.getEditableHeader=(function(){var o={getStatus:function(v){return v.Status===s.RECOMENDED_STATUS;},getUIState:function getUIState(v){return v.UIState===a.EDITABLE_HEADER;}};return function(v){return o["get"+this.getFieldName()](v);};}());S.prototype.getReadOnly=(function(){var o={getStatus:function(v){return v.Status===s.APPROVED_STATUS;},getUIState:function getUIState(v){return v.UIState===a.READONLY;}};return function(v){return o["get"+this.getFieldName()](v);};}());S.prototype.getObjectForStore=(function(){var o={getStatus:function(v){return{Status:v.Status};},getUIState:function getUIState(v){return{UIState:v.UIState,Status:v.Status};}};return function(v){return o["get"+this.getFieldName()](v);};}());S.prototype.getFieldForSearch=(function(){var o={getStatus:function(){return[];},getUIState:function getUIState(){return["UIState"];}};return function(){return o["get"+this.getFieldName()]();};}());S.prototype.getObjectStatusState=(function(){var o={getStatus:function(v){switch(v.Status){case s.APPROVED_STATUS:return"Success";case s.RECOMENDED_STATUS:return"Warning";default:return null;}},getUIState:function getUIState(v){switch(v.UIState){case a.READONLY:return"Success";case a.EDITABLE_HEADER:return"Warning";default:return null;}}};return function(v){return o["get"+this.getFieldName()](v);};}());return S;},true);