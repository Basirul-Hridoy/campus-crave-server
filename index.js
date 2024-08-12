const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//* MIDDLEWARE
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yfewkws.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API versionn
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("campusDb");
    const mealsCollection = database.collection("meals");
    const usersCollection = database.collection("users");
    const upcommingMealsCollection = database.collection("upcommingMeals");
    const reviewCollection = database.collection("review");
    const orderCollection = database.collection("order");

    {
      /*//* ============== User collection start point ===================*/
    }

    //* Post user data to the database when a user create their account
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    //* Get all the users from the database
    app.get("/users", async (req, res) => {
      const searchTerm = req.query.search;
      const query = {};

      if (searchTerm) {
        query.$or = [
          { username: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
        ];
      }
      try {
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Error fatching user" });
      }
    });

    //* Get Admin User
    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params?.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      const admin = user.role === "admin";
      res.send({ admin });
    });

    //* Update user role from database
    app.patch("/users/:id", async (req, res) => {
      const userId = req.params.id;
      const query = { _id: new ObjectId(userId) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      if (result.modifiedCount > 0) {
        res.send({ success: true, message: "user updated successfully" });
      } else {
        res.send({ success: false, message: "something went wrong" });
      }
    });

    {
      /*//* ============== User collection End point ===================*/
    }

    {
      /*//* ============== Meals collection start point ===================*/
    }

    //**Post meal data on the database */
    app.post("/meals", async (req, res) => {
      const mealsData = req.body;
      console.log(mealsData);

      //*Delete time data before findout the database for checking the existing meal
      const mealDataWithoutTime = { ...mealsData };
      delete mealDataWithoutTime.time;
      console.log("without time", mealDataWithoutTime);

      //* Checking the existing meal from databse for handle not post same data
      const existingMeals = await mealsCollection.findOne(mealDataWithoutTime);
      console.log("exist", existingMeals);

      if (!existingMeals) {
        const result = await mealsCollection.insertOne(mealsData);
        if (result.insertedId) {
          res.send({ success: true, message: "meals added successfully" });
        } else {
          res.send({ success: false, message: "something went wrong" });
        }
      } else {
        res.send({ success: false, message: "this meal already added" });
      }
    });

    //* Get all meals data from database
    app.get("/meals", async (req, res) => {
      const searchTerm = req.query.search;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;
      const skip = (page - 1) * limit;
      const query = {};

      if (searchTerm) {
        query.$or = [
          { title: { $regex: searchTerm, $options: "i" } },
          { distributorEmail: { $regex: searchTerm, $options: "i" } },
        ];
      }

      try {
        const mealsData = await mealsCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send(mealsData);
      } catch (error) {
        res.status(500).send({ error: "Error fetching meals data" });
      }
    });

    app.get("/all-meals", async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });

    //* Get a single meal from database by filtering meal ID
    app.get("/meals/:id", async (req, res) => {
      const mealId = req.params.id;
      const query = { _id: new ObjectId(mealId) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    //* Delete a meal from the database by id (only admin can do it)
    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await mealsCollection.deleteOne(filter);
      if (result.deletedCount > 0) {
        res.send({ success: true, message: "meal deleted successfully" });
      } else {
        res.status(403).send({ message: "someting went wrong!" });
      }
    });

    //* Simple user: Update increase like by single meal data from database (plot:like +1)
    app.patch("/meals/:id/like", async (req, res) => {
      const mealId = req.params.id;
      const filter = { _id: new ObjectId(mealId) };
      const updatedDoc = {
        $inc: {
          likes: 1,
        },
      };

      try {
        const result = await mealsCollection.updateOne(filter, updatedDoc);
        console.log(result);
        if (result.matchedCount === 0) {
          res.status(404).send({ error: "Meal not found" });
        } else {
          res.send({ message: "like added successfully" });
        }
      } catch (error) {
        res.status(500).send({ error: "Error updating meal" });
      }
    });

    //* Simple user: Update dicrease like by single meal data from database (plot:like -1)
    app.patch("/meals/:id/dicrease-like", async (req, res) => {
      const mealId = req.params.id;
      const filter = { _id: new ObjectId(mealId) };
      const updatedDoc = {
        $inc: {
          likes: -1,
        },
      };

      try {
        const result = await me.updateOne(filter, updatedDoc);
        if (result.matchedCount === 0) {
          res.status(404).send({ error: "Meal not found" });
        } else {
          res.send({ message: "like dicrease successfully" });
        }
      } catch (error) {
        res.status(500).send({ error: "Error updating meal" });
      }
    });
    {
      /*//* ============== Meals collection End point ===================*/
    }

    {
      /*//* ============== Upcomming meals collection Start point ===================*/
    }

    //* Post meal data on the database for upcomming meals
    app.post("/upcomming-meals", async (req, res) => {
      const upcommingMealsData = req.body;
      const filter = await upcommingMealsCollection.findOne(upcommingMealsData);

      if (!filter) {
        const result = await upcommingMealsCollection.insertOne(
          upcommingMealsData
        );
        if (result.insertedId) {
          res.send({
            success: true,
            message: "Upcomming meals added successfully",
          });
        } else {
          res.send({ success: false, message: "Something went wrong" });
        }
      } else {
        res.send({ message: "This meals already added to the collection" });
      }
    });

    //* Get all upcomming meals from database
    app.get("/upcomming-meals", async (req, res) => {
      const result = await upcommingMealsCollection.find().toArray();
      res.send(result);
    });

    //* Increase and Update upcomming meals like from user
    app.patch("/upcomming-meals/:id/like", async (req, res) => {
      const mealId = req.params.id;

      //* Assuming the user's ID is sent in the request body
      const userId = req.body.userId;

      //* Check if the user has already liked the meal
      const meal = await upcommingMealsCollection.findOne({
        _id: new ObjectId(mealId),
      });

      if (!meal) {
        return res.status(400).send({ error: "Meal not found" });
      }

      if (meal.likedBy && meal?.likedBy?.includes(userId)) {
        return res
          .status(400)
          .send({ error: "You have already liked this meal" });
      }

      //* If not, increment the likes and add the user's ID to the likedBy array
      const filter = { _id: new ObjectId(mealId) };
      const updatedDoc = {
        $inc: { likes: 1 },
        $push: { likedBy: userId },
      };
      const result = await upcommingMealsCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    //* Dicrease and Update upcomming meals like from user
    app.patch("/upcomming-meals/:id/dicrease", async (req, res) => {
      const mealId = req.params.id;
      const userId = req.body.userId;

      const meal = await upcommingMealsCollection.findOne({
        _id: new ObjectId(mealId),
      });
      if (!meal) {
        return res
          .status(400)
          .send({ error: "Meal not found on the collection" });
      }

      if (meal.likedBy && !meal.likedBy.includes(userId)) {
        return res
          .status(400)
          .send({ error: "You don't have permission to dicrease like" });
      }

      const filter = { _id: new ObjectId(mealId) };
      const updatedDoc = {
        $inc: { likes: -1 },
        $pull: { likedBy: userId },
      };
      const result = await upcommingMealsCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(result);
    });

    //* Delete upcomming meal data from upcomming meal collection
    app.delete("/upcomming-meals/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await upcommingMealsCollection.deleteOne(filter);
      if (result.deletedCount > 0) {
        res.send({ success: true, message: "Meal deleted successfully" });
      } else {
        res.send({ error: "something went wrong" });
      }
    });

    {
      /*//* ============== Upcomming meals collection End point ===================*/
    }

    {
      /*//* ============== Review collection start point ===================*/
    }

    //* Post review from the user
    app.post("/review", async (req, res) => {
      const reviewInfo = req.body;
      const result = await reviewCollection.insertOne(reviewInfo);
      if (result.insertedId) {
        res.send({ success: true, message: "Review added successfully" });
      } else {
        res.send({ error: "something went wrong" });
      }
    });

    //* Todo:(when a user gives review then update the review count like previous review +1) (when a user buys the meal then the user can review, otherwise they are not permitted to give any review and also a user can maximum one review )
    //* Update review data from the database in review collection
    app.put("/review/:id", async (req, res) => {
      const id = req.params.id;
      const updatedInfo = req.body;
      const filter = { _id: new ObjectId(id) };

      updatedDoc = {
        $set: {
          review: updatedInfo,
        },
      };
      const result = await reviewCollection.updateMany(filter, updatedDoc);
      if (result.modifiedCount > 0) {
        res.send({ success: true, message: "successfully updeted review" });
      } else {
        res.send({ error: "something went wrong" });
      }
    });

    {
      /*//* ============== Review collection End point ===================*/
    }

    {
      /*//* ============== Orderd meal Start point ===================*/
    }
    //* Post meal orderd from user
    app.post("/orderd-meal", async (req, res) => {
      const mealInfo = req.body;
      const result = await orderCollection.insertOne(mealInfo);
      if (result.insertedId) {
        res.send({ success: true, message: "order successfull" });
      } else {
        res.send({ error: "something went wrong" });
      }
    });

    //* Get all orders from order collection
    app.get("/orderd-meal", async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    //* Update requested meal status by admin
    app.patch("/orderd-meal/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "Done",
        },
      };
      const result = await orderCollection.updateOne(filter, updatedDoc);
      if (result.modifiedCount > 0) {
        res.send({ success: true, message: "order status updated" });
      } else {
        res.send({ error: "something went wrong" });
      }
    });

    {
      /*//* ============== Orderd meal collection End point ===================*/
    }

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello world");
});
app.listen(port, () => {
  console.log(`Campus app listen on the port: ${port}`);
});
