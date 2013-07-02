
var GerritIntegrationViewModel = function(repository) {
	var self = this;
	this.repository = repository;
	this.showInitCommmitHook = ko.observable(false);
	this.initCommitHookMessage = ko.observable('Init commit hook');
	this.status = ko.observable('loading');
	this.changesLoader = new ProgressBarViewModel('gerrit-' + repository.repoPath, 4000);
	this.changes = ko.observable();
	this.updateCommitHook();
	this.updateChanges();
}
GerritIntegrationViewModel.prototype.updateCommitHook = function() {
	var self = this;
	api.query('GET', '/gerrit/commithook', { path: this.repository.repoPath }, function(err, hook) {
		self.showInitCommmitHook(!hook.exists);
	});
}
GerritIntegrationViewModel.prototype.updateChanges = function() {
	var self = this;
	self.status('loading');
	this.changesLoader.start();
	api.query('GET', '/gerrit/changes', { path: this.repository.repoPath }, function(err, changes) {
		if (err || !changes) { self.status('failed'); self.changesLoader.stop(); return true; }
		self.changes(changes.slice(0, changes.length - 1).map(function(c) { return new GerritChangeViewModel(self, c); }));
		self.status('loaded');
		self.changesLoader.stop();
	});
}
GerritIntegrationViewModel.prototype.initCommitHook = function() {
	var self = this;
	this.initCommitHookMessage('Initing commit hook...');
	api.query('POST', '/gerrit/commithook', { path: this.repository.repoPath }, function(err) {
		self.updateCommitHook();
	});
}
GerritIntegrationViewModel.prototype.getChange = function(changeId) {
	return _.find(this.changes(), function(change) { return change.data.id == changeId; });
}
GerritIntegrationViewModel.prototype.getChangeIdFromMessage = function(message) {
	var changeId = _.last(message.split('\n')).trim();
	if (changeId && changeId.indexOf('Change-Id: ') == 0) {
		return changeId.slice('Change-Id: '.length).trim();
	}
}
GerritIntegrationViewModel.prototype.getChangeFromNode = function(node) {
	var changeId = this.getChangeIdFromMessage(node.message);
	if (!changeId) return;
	return this.getChange(changeId);
}
GerritIntegrationViewModel.prototype.pushForReview = function() {
	var self = this;
	var branch = this.repository.graph.activeBranch();
	var change = this.getChangeFromNode(this.repository.graph.HEAD());
	if (change) branch = change.data.branch;

	api.query('POST', '/push', { path: this.repository.graph.repoPath, socketId: api.socketId, remoteBranch: 'refs/for/' + branch }, function(err, res) {
		self.updateChanges();
	});
}

var GerritChangeViewModel = function(gerritIntegration, args) {
	this.gerritIntegration = gerritIntegration;
	this.subject = args.subject;
	this.ownerName = args.owner.name;
	this.sha1 = args.sha1;
	this.data = args;
};
GerritChangeViewModel.prototype.checkout = function() {
	var self = this;
	api.query('POST', '/fetch', { path: this.gerritIntegration.repository.repoPath, ref: this.data.currentPatchSet.ref }, function(err) {
		api.query('POST', '/checkout', { path: self.gerritIntegration.repository.repoPath, name: 'FETCH_HEAD' });
	});
}
GerritChangeViewModel.prototype.openInGerrit = function() {
	var win = window.open(this.data.url, '_blank');
  win.focus();
}