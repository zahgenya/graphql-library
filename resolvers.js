const { GraphQLError } = require('graphql');
const jwt = require('jsonwebtoken');

const Book = require('./models/book');
const Author = require('./models/author');
const User = require('./models/user');

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      try {
        const books = await Book.find({});
        const booksWithAuthors = await Promise.all(
          books.map(async (book) => {
            const author = await Author.findById(book.author);
            return {
              title: book.title,
              published: book.published,
              author: author,
              genres: book.genres,
              id: book.id
            };
          })
        );
        return booksWithAuthors;
      } catch (error) {
        throw new GraphQLError('Failed to fetch books', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            error: error.message
          }
        });
      }
    },
    allAuthors: async () => {
      try {
        const authors = await Author.find({});
        const authorsWithBookCount = await Promise.all(
          authors.map(async (author) => {
            const bookCount = await Book.countDocuments({ author: author._id });
            return { ...author.toObject(), bookCount };
          })
        );
        return authorsWithBookCount;
      } catch (error) {
        throw new GraphQLError('Failed to fetch authors', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            error: error.message
          }
        });
      }
    },
    me: (root, args, context) => {
      return context.currentUser;
    }
  },
  Author: {
    books: (parent) => {
      return Book.find({ author: parent._id });
    },
    bookCount: (parent) => {
      return parent.bookCount;
    }
  },
  Mutation: {
    addBook: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError('not authenticated', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      }

      try {
        let author = await Author.findOne({ name: args.author });

        if (!author) {
          author = new Author({ name: args.author });
          author = await author.save();
        }

        const book = new Book({
          title: args.title,
          published: args.published,
          author: author,
          genres: args.genres
        });

        await book.save();

        return book;
      } catch (error) {
        throw new GraphQLError('Saving book failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.name,
            error
          }
        });
      }
    },

    editAuthor: async (root, args) => {
      const author = await Author.findOne({ name: args.author });
      if (!author) {
        return null;
      }
      author.born = args.setBornTo;
      try {
        await author.save();
      } catch (error) {
        throw new GraphQLError('Failed to update author', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.name,
            error
          }
        });
      }

      return author;
    },

    createUser: async (root, args) => {
      const user = new User({ username: args.username });
      return user.save().catch((error) => {
        throw new GraphQLError('Creating the user failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.username,
            error
          }
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });

      if (!user || args.password !== 'secret') {
        throw new GraphQLError('wrong credentials', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        });
      }

      const userForToken = {
        username: user.username,
        id: user._id
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
    addFavoriteGenre: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError('wrong credentials', {
          extensions: { code: 'BAD_INPUT' }
        })
      }
      currentUser.favoriteGenres = args.genres;
      try {
        await currentUser.save();
      } catch (error) {
        throw new GraphQLError('Failed to update user', {
          extensions: {
            code: 'BAD_USER_INPUT',
            error
          }
        });
      }

      return currentUser;
    }
  }
};

module.exports = resolvers;
