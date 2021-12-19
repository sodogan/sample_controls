/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils"],function(U){var n=U.notNull;var I=["AdjustedValue","Value","AdjustedCost","Cost","RedemptionRate"];var T=["PromoCostPrice"];function c(v,a){return v.indexOf(a)>=0;}function d(a,b){return a&&b;}function o(a,b){return a||b;}function e(){var a=Array.prototype.splice.call(arguments,0);return a.filter(n).reduce(d,true);}function s(p,a,b,g,h){var i=p.map(function(k){return U.get(b,[a,k,"Visible"]);});var j=i.filter(function(k){if(n(k)){return k;}return true;}).reduce(o,false);return e.apply(this,[g==="X"].concat(h))&&j;}function f(a,h,b,p,g,i){if(a===false){return false;}if(p===true){return false;}if(g==="05"||g==="06"){return false;}if(i){return i.Editable&&i.Visible;}return b==="I"&&!!h;}return{INCENTIVE_MORE_PROPERTIES:I,TERM_MORE_PROPERTIES:T,productComboFormatter:function(a,p,h,b){if(a==="20"){return false;}if(c(["01","11","12"],a)){return n(p)?p:true;}if(c(["02","03"],a)){var g=h||b;return n(g)?g:true;}return true;},percentageFormatter:function(p){var N=sap.ui.core.format.NumberFormat.getFloatInstance({maxFractionDigits:2,groupingEnabled:false});return N.format(p||0)+" %";},quantityUoMFormatter:function(a,q,u){if(a==="20"){return false;}q=n(q)?q:true;u=n(u)?u:true;return q||u;},quanitySizeFormatter:function(q,u){q=n(q)?q:true;u=n(u)?u:true;if(q&&u){return"L9 M9 S9";}if(q){return"L12 M12 S12";}return"L9 M9 S9";},uomSizeFormatter:function(q,u){q=n(q)?q:true;u=n(u)?u:true;if(q&&u){return"L3 M3 S3";}if(u){return"L12 M12 S12";}return"L3 M3 S3";},quanityUoMLabelFormatter:function(a,q,u,b,g){b=n(b)?b:true;g=n(g)?g:true;if(b&&g){return a;}if(b){return q;}if(g){return u;}return a;},inputSize6:function(a,v){var i=!n(v);if(a==="X"&&(i||v)){return"L6 M6 S6";}else{return"L12 M12 S12";}},termBlockSize:function(a){if(a==="X"){return"L4 M12 S12";}else{return"L6 M12 S12";}},labelFormatter:function(v,V,b,a){function g(i,j,k){var l=!n(j);if(l||j){i.push(k);}}var h=[];g(h,v,V);g(h,b,a);return h.join(" / ");},booleanFormatter:e,promoCostPriceVisiblityFormatter:function(a,b,g,h){return e(a!=="12",b==="X",g,h);},userProjectionFormatter:function(a,u,p){return e(a,u,!p);},packageOfferBooleanFormatter:function(){var a=Array.prototype.splice.call(arguments,0);var p=!a[0];a.shift();return e.apply(this,[p].concat(a));},featureFormatter:function(a){var b=Array.prototype.splice.call(arguments,1);return e.apply(this,[a==="X"].concat(b));},quantityTextFormatter:function(q,u){var N=sap.ui.core.format.NumberFormat.getFloatInstance({maxFractionDigits:3,groupingEnabled:false});var v=N.format(q||0);return!u?v:v+" / "+u;},promoCostPriceCurrencyVisiblityFormatter:function(v,a,b,g){return e(v>3,a,b,g);},promoCostPriceTextFormatter:function(v,p,a){var N=sap.ui.core.format.NumberFormat.getFloatInstance({maxFractionDigits:5,groupingEnabled:false});var b=N.format(p||0);if(v>3&&a){return b+" / "+a;}return b;},discountTextFormatter:function(v,a){var N=sap.ui.core.format.NumberFormat.getFloatInstance({maxFractionDigits:5,groupingEnabled:false});var b=N.format(v||0);return!a?b:b+" "+a;},discountVarietyHiddenFormatter:function(a,b){return e(a!=="01",b);},seeMoreVisible:s,termsSeeMoreVisible:function(a,b){var g=Array.prototype.splice.call(arguments,2);var h=a.Selection.DimensionType!=="12";g.push(h);return s(T,"ProductConfig",a,b,g);},incentivesSeeMoreVisible:function(a,b){var g=Array.prototype.splice.call(arguments,2);return s(I,"Config",a,b,g);},detailsSubDiscountFormatter:f,detailsDiscountFormatter:function(a,h,p,b,g){return f(a,h,"I",p,b,g);}};},true);