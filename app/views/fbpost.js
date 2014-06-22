import Ember from 'ember';

export default Ember.View.extend({
	tagName: 'div',
	attributeBindings: ['data-width','data-href'],
	'data-width': '466',
	classNames: ['fb-post'],
	relayout: function() {
		this.$().find('iframe').done(function () {
        	msnry.layout();// window.console.log('cabou');
    	});
		// msnry.layout();
	},
	didInsertElement: function() {
    	// window.setTimeout(function(){
    	// 	var msnry = $(this.$().parent()).masonry();
    	// 	msnry.layout();
    	// }, 1000);
		// var mas = this.$().parent().masonry();
		// window.setTimeout(function(){
		
		Ember.run.debounce(this, this.relayout, 1000);
		// }, 2500);
  	}
});
