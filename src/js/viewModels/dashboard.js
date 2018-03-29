/**
 * Copyright (c) 2014, 2017, Oracle and/or its affiliates.
 * The Universal Permissive License (UPL), Version 1.0
 */
define([
    'ojs/ojcore', 'knockout', 'jquery',
    'resources/config',
    'persist/persistenceStoreManager',
    'persist/pouchDBPersistenceStoreFactory',
    'persist/persistenceManager',
    'persist/defaultResponseProxy',
    'persist/oracleRestJsonShredding',
    'persist/queryHandlers',
    'persist/impl/logger',
    'viewModels/helpers/employeesHelper',
    'ojs/ojmodel', 'ojs/ojpagingcontrol', 'ojs/ojbutton', 'ojs/ojlistview', 'ojs/ojarraydataprovider',
    'ojs/ojinputtext', 'ojs/ojdialog', 'ojs/ojinputtext', 'ojs/ojlabel'
], function (
    oj, ko, $,
    config,
    persistenceStoreManager,
    pouchDBPersistenceStoreFactory,
    persistenceManager,
    defaultResponseProxy,
    oracleRestJsonShredding,
    queryHandlers,
    logger,
    empls
) {
    function DashboardViewModel() {
        var self = this;
        var offsetVal = 0;

        window.addEventListener('online', onlineHandler);

        function onlineHandler() {
            self.synchOfflineChanges();
        }

        self.searchName = ko.observable();
        self.allItems = ko.observableArray();
        self.dataProvider = new oj.ArrayDataProvider(self.allItems, {'idAttribute': 'id'});
        self.selectedItem = ko.observable();
        self.employeeModel = ko.observable();
        self.employeeId = ko.observable();
        self.employeeName = ko.observable();
        self.employeeModel(empls.createEmployeeModel());

        logger.option('level', logger.LEVEL_LOG);

        persistenceStoreManager.registerDefaultStoreFactory(pouchDBPersistenceStoreFactory);
        persistenceManager.init().then(function () {
            persistenceManager.register({scope: '/Employees'})
            .then(function (registration) {
                var responseProxy = defaultResponseProxy.getResponseProxy({
                    jsonProcessor: {
                        shredder: oracleRestJsonShredding.getShredder('emp', 'EmployeeId'),
                        unshredder: oracleRestJsonShredding.getUnshredder()
                    },
                    queryHandler: queryHandlers.getOracleRestQueryHandler('emp')
                });
                var fetchListener = responseProxy.getFetchEventListener();
                registration.addEventListener('fetch', fetchListener);
            });
        });

        $.ajax({
            url: 'https://' + config.hostname + '/api/jet/Employees',
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                console.log(data);

                self.allItems.removeAll();
                for (var i = 0; i < data.count; i++) {
                    self.allItems.push({"id": data.items[i].EmployeeId, "item": data.items[i].FirstName});
                }
                console.log('Online: ' + persistenceManager.isOnline());
            },
            error: function () {
                console.log('Fetch failed');
            }
        });

        self.fetchNext = function () {
            offsetVal = offsetVal + 5;
            self.fetchData();
        };

        self.fetchPrevious = function () {
            if (offsetVal > 0) {
                offsetVal = offsetVal - 5;
            }
            self.fetchData();
        };

        self.fetchData = function () {
            empls.createEmployeesCollection().fetch({
                startIndex: offsetVal,
                fetchSize: 5,
                success: function (collection) {
                    self.allItems.removeAll();
                    for (var i = 0; i < collection.size(); i++) {
                        self.allItems.push({
                            "id": collection.models[i].attributes.EmployeeId,
                            "item": collection.models[i].attributes.FirstName
                        });
                        console.log(collection.models[i].attributes.FirstName);
                    }

                    console.log('Online: ' + persistenceManager.isOnline());
                }
            });
        };

        self.searchData = function () {
            var searchUrl = "https://" + config.hostname + "/api/jet/Employees?q=FirstName='" + self.searchName() + "'";

            $.ajax({
                url: searchUrl,
                type: 'GET',
                dataType: 'json',
                success: function (data) {
                    console.log(data);

                    self.allItems.removeAll();
                    for (var i = 0; i < data.count; i++) {
                        self.allItems.push({"id": data.items[i].EmployeeId, "item": data.items[i].FirstName});
                    }

                    console.log('Online: ' + persistenceManager.isOnline());
                },
                error: function () {
                    console.log('Fetch failed');
                }
            });
        };

        self.handleCurrentItemChanged = function () {
            self.employeeId(self.selectedItem().data.id);
            self.employeeName(self.selectedItem().data.item);

            document.querySelector('#md1').open();
        };

        self.submitUpdate = function () {
            self.employeeModel().save(self.buildEmployeeModel(), {
                // contentType: 'application/vnd.oracle.adf.resourceitem+json',
                contentType: 'application/json',
                patch: 'patch',
                success: function () {
                    console.log('DB UPDATE SUCCESS');
                },
                error: function (jqXHR, textStatus, errorThrown) {}
            });

            for (var i = 0; i < self.allItems().length; i++) {
                if (self.allItems()[i].id === self.employeeId()) {
                    self.allItems.splice(i, 1, {"id": self.employeeId(), "item": self.employeeName()});
                }
            }

            document.querySelector('#md1').close();
        };

        self.buildEmployeeModel = function () {
            return {
                'EmployeeId': self.employeeId(),
                'FirstName': self.employeeName()
            };
        };

        self.synchOfflineChanges = function () {
            persistenceManager.getSyncManager().sync()
                .then(function () {
                    console.log('DB SYNCH DONE');
                }, function (error) {
                    var requestId = error.requestId;
                    persistenceManager.getSyncManager().removeRequest(requestId);
                }
            );
        };

        self.renderer = function (context) {
            return {'insert': context['data']['item']};
        };
    }

    return new DashboardViewModel();
});
