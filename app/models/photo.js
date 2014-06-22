var Photo = DS.Model.extend({
  data_href:  DS.attr('string'),
  poster:     DS.attr('string'),
  poster_url: DS.attr('string')
});
 
Photo.reopenClass({
  FIXTURES: [
    { id: 1, data_href: 'https://www.facebook.com/photo.php?fbid=811592658860640&amp;set=a.152052341481345.27543.100000297401072&amp;type=1', poster: 'Gustavo Siqueira', poster_url: 'https://www.facebook.com/Dr.Gustavoo' },
    { id: 2, data_href: 'https://www.facebook.com/photo.php?fbid=675174879169086&amp;set=a.675178309168743&amp;type=1', poster: 'Gustavo Siqueira', poster_url: 'https://www.facebook.com/Dr.Gustavoo' },
    { id: 3, data_href: 'https://www.facebook.com/photo.php?fbid=810081575678415&amp;set=a.394435277243049.97054.100000297401072&amp;type=1', poster: 'Gustavo Siqueira', poster_url: 'https://www.facebook.com/Dr.Gustavoo' },
    { id: 4, data_href: 'https://www.facebook.com/photo.php?fbid=796861753667064&amp;set=a.234052603281318.65271.100000297401072&amp;type=1', poster: 'Gustavo Siqueira', poster_url: 'https://www.facebook.com/Dr.Gustavoo' },
    { id: 5, data_href: 'https://www.facebook.com/Dr.Gustavoo/posts/767702036583036:0', poster: 'Gustavo Siqueira', poster_url: 'https://www.facebook.com/Dr.Gustavoo' },
    { id: 6, data_href: 'https://www.facebook.com/photo.php?fbid=10152569681772448&amp;set=a.10150377968907448.401756.510972447&amp;type=1', poster: 'Linda Demah', poster_url: 'https://www.facebook.com/linda.demah' }
  ]
});
 
export default Photo;