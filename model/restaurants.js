var mongoose = require('mongoose');

var restaurantsSchema = mongoose.Schema({
    restaurant_id: String,
    name: {type:String,required: true},
    borough: String,
    cuisine: String,    
    photoMimetype: String,
    photo : String,
    address:[{
        street:String,
        building:String,
        zipcode:String,
        coord:[{ lat: Number, lon: Number }]
    }],
    grades:[{user:String,score:Number}],
    owner:{type:String,required: true}
});

module.exports = restaurantsSchema;