/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["retail/pmr/promotionaloffers/utils/Utils"],function(U){function g(z){if(z.length===0){return[];}var A=z.reduce(function(a,b){return Math.max(a,b.length);},Number.MIN_VALUE);var B=[];for(var i=0;i<A;i++){var C=[];for(var j=0;j<z.length;j++){var D=z[j];C.push(D[D.length-i-1]);}B.unshift(C);}return B;}function c(a){if(a.length===0){return[];}var b=g(a);var i=U.find(U.allEqual,b);if(!i){return null;}var j=U.takeWhile(U.not(U.allEqual),b);return U.unique(U.concatAll(j)).concat(i[0]);}function d(i){return i.N_ID;}function e(i){return i.P_ID;}function f(a){return a.hasOwnProperty("LocationId");}function s(a,b,j){var z=a[b];var A=[];U.walk(z,function(i){if(i.closed){i.checked=false;A.push(d(i));}else{i.checked=j;A.push(d(i));}});return A;}function h(i){return i.currentSelection.concat([]);}function p(i,a){var b=[];var j=a[i];var z=e(j);while(z!==undefined&&z!==null){var A=e(j);b.push(A);j=a[A];z=e(j);}if(b.length===0){b.push(i);}return b;}function k(a,b,i){var j=a.filter(function(C){return n(i[C]).length===0;});var z=j.concat(b).map(function(C){return p(C,i);});var A=c(z);var B=b;if(A){A.forEach(function(C){i[C].checked=true;B.push(C);});B=B.concat(a);}else{a.forEach(function(C){i[C].checked=false;});b.forEach(function(C){var D=i[C];var E=e(D);if(D.LocationId&&i[E]){i[E].checked=true;B.push(E);B.push(C);}});}return B;}function l(i){return i.NodeId||i.LocationId;}function m(a,b,j,z){var A={};var B=[];var C=0;var D=z?z.StartOfOffer:null;var E=z?z.EndOfOffer:null;for(var i=0;i<a.length;i++){U.walk(a[i],function(F,G){F.N_ID=C;F.P_ID=(G||{}).N_ID;var H=d(F);var I=l(F);if(U.isClosed(F,D,E)){F.closed=true;j.push(d(F));}if(b.indexOf(I)>=0){U.walk(F,function(F){F.checked=true;});}if(j.indexOf(I)>=0){U.walk(F,function(F){F.checked=false;});}if(F.closed){F.checked=false;}A[H]=F;if(F.checked){B.push(H);}C++;});}A.currentSelection=B;return A;}function n(a){var b=[];for(var i in a){if(a.hasOwnProperty(i)&&jQuery.isNumeric(i)){b.push(i);}}return b;}function o(a,i){if(!a.closed){var b=h(i);var j=s(i,d(a),true);var z=b.length>0&&j.length>0;var A=j.concat(b);if(z||f(a)){var B=k(b,j,i);A=j.concat(B);}i.currentSelection=U.unique(A);}else{a.checked=false;}}function q(a,b){var j=d(a);var q={};U.walk(a,function(i){i.checked=false;q[d(i)]=true;});var z=b[d(a)];z.checked=false;q[d(z)]=true;while(U.notNull(b[e(z)])){if(r(z,b)){b[e(z)].checked=false;q[d(b[e(z)])]=true;}z=b[e(z)];}b.currentSelection=b.currentSelection.filter(function(i){return!q[i];});}function r(a,b){var j=true;if(U.notNull(e(b[d(a)]))){var z=b[e(b[d(a)])];var A=0;for(var i in z){if(z.hasOwnProperty(i)&&jQuery.isNumeric(i)){if(z[i].checked){j=false;A++;}}}if(A===0){return true;}if(U.notNull(e(z))){r(z,b);}else{if(a.NodeId&&A===1){return true;}if(j){return true;}}}else{return false;}}function t(a,i,b){if(b){o(a,i);}else{q(a,i);}}function u(a){return a.some(function(i){return i.checked;});}function v(a,b){return a.length-b.length;}function w(i){function a(i){return function(b){return{checked:i[b].checked||false,id:b};};}return function(b){return p(b,i).map(a(i));};}function x(i){var a=i.currentSelection;if(a.length<=1){return a[0];}var b=a.map(w(i)).filter(u).sort(v);return b[0][0].id;}function y(a,b){var a=b[a];var j=[];U.walk(a,function(i){if(!i.checked){j.push(d(i));}});return j;}function S(a,i,b,j){this.index=m(a,i||[],b||[],j);this.tree=a;}S.prototype.runSelection=function(a,b){t(a,this.index,b);return this.tree;};S.prototype.getSelection=function(){var i=this.index;var a=x(i);if(a===null||a===undefined){return{selection:null,exclusions:[]};}var b=y(a,i).map(function(j){return i[j];});return{selection:i[a],exclusions:b};};S.prototype.getById=function(i){return this.index[i];};return S;},true);