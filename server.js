var express = require('express');
var session = require('cookie-session');
var bodyParser = require('body-parser');

var http = require('http');
var url = require('url');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectID = require('mongodb').ObjectID;
var mongourl = 'mongodb://hellowah5:hellowah5@ds149682.mlab.com:49682/11664934';
//var mongourl = 'mongodb://test:daniel6a3000@ds151402.mlab.com:51402/daniel6a3000';
var mongoose = require('mongoose');
//mongoose.connect('mongodb://test:daniel6a3000@ds151402.mlab.com:51402/daniel6a3000');

var fs = require('fs');
var formidable = require('formidable');

var assert = require('assert');
var ObjectID = require('mongodb').ObjectID;
var util = require('util');

var app = express();

app.set('view engine', 'ejs');

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';

app.set('view engine', 'ejs');

app.use(session({
	name: 'session',
	keys: [SECRETKEY1, SECRETKEY2]
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', function (req, res) {
	console.log(req.session);
	if (!req.session.authenticated) {
		res.redirect('/login');
	} else {
		res.status(200);
		res.redirect('/read');
		//res.render('secrets',{name:req.session.username});
	}
});

//login
app.get('/login', function (req, res) {
	//res.sendFile(__dirname + '/public/login.html');
	res.render('login.ejs');
});

app.post('/login', function (req, res) {
	var userData = { userid: req.body.name, password: req.body.password }
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		db.collection("users").findOne(userData, function (err, result) {
			if (!err) {
				if (result) {
					console.log('Login success!')
					req.session.authenticated = true
					req.session.username = result.userid
					res.redirect('/')
				} else {
					console.log('Invalid username or password')
					res.redirect('/')
				}
			}
			db.close()
		})
	})
});

//register
app.get('/register', function (req, res) {
	//res.sendFile(__dirname + '/public/register.html')
	res.render('register.ejs');
})

app.post('/register', function (req, res) {
	MongoClient.connect(mongourl, function (err, db) {
		if (err) throw err
		var username = req.body.userid
		var pwd = req.body.password
		var userData = { userid: username, password: pwd }
		db.collection("users").findOne({ userid: username }, function (err, result) {
			if (err) throw err
			if (result === null) {
				db.collection("users").insertOne(userData, function (err, res) {
					if (err) throw err
					console.log("Registration completed!")
				})
			} else {
				console.log('This username has been used!')
			}
			db.close()
		})
	})
	res.redirect('/');
})

//create new restaurant
app.get('/create', function (req, res) {
	//res.sendFile(__dirname + '/public/create.html')
	res.render('create.ejs');
})

app.post('/create', function (req, res) {
	if (req.url == '/create' && req.method.toLowerCase() == 'post') {
		var form = new formidable.IncomingForm();
		console.log("About to parse...");
		form.parse(req, function (err, fields, files) {
			if (err) {
				console.log(err);
			}
			console.log("Parsing done.");
			// console.log(fields);
			// console.log(files);
			mongoose.connect(mongourl, { useNewUrlParser: true });
			//mongoose.createConnection(mongourl)	
			var restaurantsSchema = require('./model/restaurants');
			var db = mongoose.connection;
			var name = fields.name;
			var borough = fields.borough;
			var cuisine = fields.cuisine;
			var street = fields.street;
			var building = fields.building;
			var zipcode = fields.zipcode;
			var lat = fields.lat;
			var lon = fields.lon;
			var filename = files.photo.path;
			var mimetype = "";
			var photo = "";
			if (files.photo.type) {
				mimetype = files.photo.type;
			}
			fs.readFile(filename, function (err, data) {
				photo = new Buffer(data).toString('base64');
			})
			db.on('error', console.error.bind(console, 'connection error:'));
			db.once('open', function (callback) {
				var Restaurants = mongoose.model('Restaurants', restaurantsSchema)
				var newRestaurant = new Restaurants({
					name: name, borough: borough,
					cuisine: cuisine,
					photoMimetype: mimetype,
					photo: photo,
					address: [{
						street: street, building: building,
						zipcode: zipcode, coord: [{ lat: lat, lon: lon }]
					}],
					owner: req.session.username
				})

				console.log(typeof newRestaurant);

				newRestaurant.validate(function (err) {
					console.log(err);
				})

				newRestaurant.save(function (err, documentInserted) {
					if (err) {
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.write(JSON.stringify({ status: 'failed' }));
						db.close();
					} else {
						console.log('Restaurants created!')
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.write(JSON.stringify({ status: 'ok', _id: documentInserted._id }));
						db.close();
					}
				});
			});

		})
		return
	}
});

//Search
app.get('/search', function (req, res) {
	res.render('search', {});
});

// app.post('/search', function(req,res){
// 	if (!req.session.authenticated) {
// 		res.redirect('/login')
// 	} else {
// 		MongoClient.connect(mongourl, function (err, db) {
// 			try {
// 				assert.equal(err, null);
// 			} catch (err) {
// 				res.set({ "Content-Type": "text/plain" });
// 				res.status(500).end("MongoClient connect() failed!");
// 			}
// 			console.log('Connected to MongoDB');
// 			findRestaurants(db, {}, function (restaurants) {
// 				db.close();
// 				console.log("Showing " + restaurants.length + " document(s)");
// 				console.log('Disconnected MongoDB\n');
// 				res.render('list.ejs', { name: req.session.username, restaurants: restaurants, c: "{}" });
// 			});
// 		});
// 	}
// })

app.post('/search', function (req, res) {
	MongoClient.connect(mongourl, function (err, db) {
		var name = req.body.name;
		var borough = req.body.borough;
		var cuisine = req.body.cuisine;

		var find = {};
		var criteria;
		if (name != "") {
			find.name = name;
		}
		if (borough != "") {
			find.borough = borough;
		}
		if (cuisine != "") {
			find.cuisine = cuisine;
		}
		console.log("find: " + JSON.stringify(find));
		db.collection("restaurants").find(find).toArray(function (err, result) {
			if (err) throw err

			if (result.length != 0) {
				console.log(result[0].name);
				res.render('list.ejs', { name: req.session.username, restaurants: result, c: JSON.stringify(find)});
				//res.render('landing',{msg:result});
			} else {
				res.render('list.ejs', { name: req.session.username, restaurants: result, c: criteria });
				//res.render('landing', { msg: [{ name: 'you found nothing' }] });
			}
			db.close()
		})
	})
})

//restaurants list
app.get('/read', function (req, res) {
	console.log(req.session)
	if (!req.session.authenticated) {
		res.redirect('/login')
	} else {
		MongoClient.connect(mongourl, function (err, db) {
			try {
				assert.equal(err, null);
			} catch (err) {
				res.set({ "Content-Type": "text/plain" });
				res.status(500).end("MongoClient connect() failed!");
			}
			console.log('Connected to MongoDB');
			findRestaurants(db, {}, function (restaurants) {
				db.close();
				console.log("Showing " + restaurants.length + " document(s)");
				console.log('Disconnected MongoDB\n');
				res.render('list.ejs', { name: req.session.username, restaurants: restaurants, c: "{}" });
			});
		});
	}
})

function findRestaurants(db, criteria, callback) {
	var cursor = db.collection('restaurants').find(criteria);
	var restaurants = [];
	cursor.each(function (err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants);
		}
	});
}

//display restaurant
app.get('/display', function (req, res) {
	MongoClient.connect(mongourl, function (err, db) {
		try {
			assert.equal(err, null);
		} catch (err) {
			res.set({ "Content-Type": "text/plain" });
			res.status(500).end("MongoClient connect() failed!");
		}
		var criteria = {};
		criteria['_id'] = ObjectID(req.query._id);
		findRestaurants(db, criteria, function (restaurants) {
			db.close();
			console.log('Read restaurant: ' + restaurants[0].name);
			var lat = restaurants[0].address[0].coord[0].lat
			var lon = restaurants[0].address[0].coord[0].lon;
			var showGmap = ((lat && lon) != null);
			console.log("show Gmap: " + showGmap);

			var grades = restaurants[0].grades;
			var sum =0
			for(var grade of grades){
				sum = sum+ grade.score;
			};
			var avg = sum/grades.length;
			var msg = (avg) ?  avg+" (Average) " : " No Ratings" ;
			res.render('display.ejs', { restaurants: restaurants, g: showGmap, avg:msg });
		});
	});
});

//Edit
app.get('/change', function (req, res) {
	MongoClient.connect(mongourl, function (err, db) {
		try {
			assert.equal(err, null);
		} catch (err) {
			res.set({ "Content-Type": "text/plain" });
			res.status(500).end("MongoClient connect() failed!");
		}

		var criteria = {};
		criteria['_id'] = ObjectID(req.query._id);
		findRestaurants(db, criteria, function (restaurants) {
			var isOwner = false;
			if (restaurants[0].owner == req.session.username) {
				isOwner = true;
				console.log("You can edit Restaurants:" + restaurants[0].name);
			} else {
				console.log("You are not authorized to delete!!! \n")
			}
			db.close();
			res.render('change.ejs', { restaurants: restaurants, g: isOwner });
		});
	});
});

app.post('/change', function (req, res) {
	var criteria = {};
	criteria['_id'] = ObjectID(req.query._id);
	if (req.url.startsWith('/change') && req.method.toLowerCase() == 'post') {
		var form = new formidable.IncomingForm();
		form.parse(req, function (err, fields, files) {
			if (err) {
				console.log(err);
			}
			mongoose.connect(mongourl, { useNewUrlParser: true });
			var restaurantsSchema = require('./model/restaurants');
			var db = mongoose.connection;
			var name = fields.name;
			var borough = fields.borough;
			var cuisine = fields.cuisine;
			var street = fields.street;
			var building = fields.building;
			var zipcode = fields.zipcode;
			var lat = fields.lat;
			var lon = fields.lon;
			var filename = files.photo.path;
			var mimetype = "";
			var photo = "";
			if (files.photo.type) {
				mimetype = files.photo.type;
			}
			if (mimetype != 'application/octet-stream') {
				fs.readFile(filename, function (err, data) {
					photo = new Buffer(data).toString('base64');
				})
			}
			db.on('error', console.error.bind(console, 'connection error:'));
			db.once('open', function (callback) {
				var Restaurants = mongoose.model('Restaurants', restaurantsSchema)
				if (photo == "") {
					console.log("No Photo is uploaded")
					Restaurants.updateOne(criteria,
						{
							$set: {
								name: name, borough: borough,
								cuisine: cuisine,
								photoMimetype: mimetype,
								address: [{
									street: street,
									building: building,
									zipcode: zipcode,
									coord: [{ lat: lat, lon: lon }]
								}]
							}
						},
						function (err) {
							if (err) {
								console.log(err);
							}
							res.redirect('/display?_id=' + criteria['_id']);
							//res.render('display.ejs',{restaurants:restaurants});
							console.log("Update Success!\n");
						});
				}
				else {
					console.log("Photo is updated");
					Restaurants.updateOne(criteria,
						{
							$set: {
								name: name, borough: borough,
								cuisine: cuisine,
								photoMimetype: mimetype,
								photo: photo,
								address: [{
									street: street,
									building: building,
									zipcode: zipcode,
									coord: [{ lat: lat, lon: lon }]
								}]
							}
						},
						function (err) {
							if (err) {
								console.log(err);
							}
							res.redirect('/display?_id=' + criteria['_id']);
							//res.render('display.ejs',{restaurants:restaurants});
							console.log("Update Success!\n");
						});
				}
			});
		})
		return
	}
});

//Rate
app.get('/rate', function (req, res) {
	MongoClient.connect(mongourl, function (err, db) {
		try {
			assert.equal(err, null);
		} catch (err) {
			res.set({ "Content-Type": "text/plain" });
			res.status(500).end("MongoClient connect() failed!");
		}
		var criteria = {};
		criteria['_id'] = ObjectID(req.query._id);
		findRestaurants(db, criteria, function (restaurants) {
			console.log(restaurants[0].grades)
			var grades = restaurants[0].grades;
			var hasRated = false;
			for(var grade of grades){
				if (grade.user == req.session.username) {
					hasRated = true;
				} 
			};
			db.close();
			console.log(hasRated?"You have rated this restaurant!!! \n":"You can rate Restaurants:" + restaurants[0].name);
			res.render('rate.ejs', { restaurants: restaurants, g: hasRated });
		});
	});
});

app.post('/rate', function (req, res) {
	var criteria = {};
	criteria['_id'] = ObjectID(req.query._id);
	if (req.url.startsWith('/rate') && req.method.toLowerCase() == 'post') {
		var form = new formidable.IncomingForm();
		form.parse(req, function (err, fields, files) {
			if (err) {
				console.log(err);
			}
			mongoose.connect(mongourl, { useNewUrlParser: true });
			var restaurantsSchema = require('./model/restaurants');
			var db = mongoose.connection;
			var score = fields.score;
			var gradeObj={};
			
			db.on('error', console.error.bind(console, 'connection error:'));
			db.once('open', function (callback) {
				var Restaurants = mongoose.model('Restaurants', restaurantsSchema)
				gradeObj.user = req.session.username;
				gradeObj.score = score;
				if(score==null||score=="")
				{
					res.status(500).send('/rate invalid query parameters!');
				}else{
				Restaurants.updateOne(criteria,
					{
						$push: { grades: gradeObj }
					},
					function (err) {
						if (err) {
							console.log(err);
						}
						res.redirect('/display?_id=' + criteria['_id']);
						//res.render('display.ejs',{restaurants:restaurants});
						console.log("Rate Success!\n");
					});}
			});
		})
		return
	}
});

//delete
app.get('/delete', function (req, res) {
	MongoClient.connect(mongourl, function (err, db) {
		try {
			assert.equal(err, null);
		} catch (err) {
			res.set({ "Content-Type": "text/plain" });
			res.status(500).end("MongoClient connect() failed!");
		}

		var criteria = {};
		criteria['_id'] = ObjectID(req.query._id);
		findRestaurants(db, criteria, function (restaurants) {
			var isOwner = false;
			if (restaurants[0].owner == req.session.username) {
				isOwner = true;
				console.log("User: " + restaurants[0].owner + " Deleted Restaurants:" + restaurants[0].name);
				db.collection("restaurants").remove({ _id: criteria['_id'] });
			} else {
				console.log("You are not authorized to delete!!! \n")
			}
			db.close();
			res.render('remove.ejs', { g: isOwner });
		});
	});
})

//Gmap
app.get("/gmap", function (req, res) {
	res.render("gmap.ejs", {
		lat: req.query.lat,
		lon: req.query.lon,
		name: req.query.title
	});
	res.end();
});

//api
app.get('/api/restaurant/:by/:value', function (req, res) {

	MongoClient.connect(mongourl, function (err, db) {
		var by = req.params.by;
		var value = req.params.value;
		console.log(by);
		console.log(value);
		switch (by) {
			case 'name':
				db.collection("restaurants").find({ name: value }).toArray(function (err, result) {
					if (err) throw err
					if (result != null) {
						console.log(result);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						result.forEach(function (ele) {
							res.write(JSON.stringify(ele,null,'\t'));
						})
						res.end();
					} else {
						res.render('landing', { msg: 'you found nothing' });
					}
					db.close()
				})
				break;
			case 'borough':
				db.collection("restaurants").find({ borough: value }).toArray(function (err, result) {
					if (err) throw err
					if (result != null) {
						console.log(result);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						result.forEach(function (ele) {
							res.write(JSON.stringify(ele,null,'\t'));
						})
					} else {
						res.render('landing', { msg: 'you found nothing' });
					}
					db.close()
				})
				break;
			case 'cuisine':
				db.collection("restaurants").find({ cuisine: value }).toArray(function (err, result) {
					if (err) throw err
					if (result != null) {
						console.log(result);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						result.forEach(function (ele) {
							res.write(JSON.stringify(ele,null,'\t'));
						})
					} else {
						res.render('landing', { msg: 'you found nothing' });
					}
					db.close()
				})
		}
	});
})


var test = { daniel: 123, ethan: 456, Alan: 789 };

//logout
app.get('/logout', function (req, res) {
	req.session = null;
	res.redirect('/');
	console.log("Logout !");
});

app.listen(process.env.PORT || 8099);
