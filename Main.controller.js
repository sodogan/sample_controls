/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/core/mvc/Controller","retail/pmr/promotionaloffers/utils/Utils","retail/pmr/promotionaloffers/utils/Models"],function(C,U,M){"use strict";var a=C.extend("retail.pmr.promotionaloffers.Main",{onInit:function(){var m=this.getOwnerComponent().getModel();M.init(m);U.setComponent(this.getOwnerComponent());},onExit:function(){if(this.app){this.app.getParent().destroyContent();}}});return a;});
